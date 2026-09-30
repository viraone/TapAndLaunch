import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateHaversineMiles } from "@/lib/listings/travel";
import { fetchGoogleStations, isGoogleConfigured } from "@/lib/gas/google";
import { fetchOverpassStations } from "@/lib/gas/overpass";
import type { Database, FuelGrade } from "@/types/database";

type StationRow = Database["public"]["Tables"]["gas_stations"]["Row"];

/** One station as the published app renders it, with distance from the
 * viewer already computed. */
export interface NearbyStation {
  id: string;
  name: string;
  brand: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  prices: Partial<Record<FuelGrade, { price: number; updatedAt: string | null }>>;
  priceSource: "google" | "user" | null;
}

/** How long a fetched cell is trusted before Google is asked again. Gas
 * prices don't move within the hour; this is what keeps a busy neighborhood
 * at ~720 calls/month, inside Google's free tier. */
const CELL_TTL_MS = 60 * 60 * 1000;
/** Hard ceiling on Google calls per app per day — a bug or a bot can't
 * turn into a bill. 200/day is ~6,000/month, far above normal use. */
const DAILY_CALL_BUDGET = 200;
/** ~1 mile at Seattle's latitude; the grid Google results are cached on. */
const CELL_SIZE_DEG = 0.015;

export function cellKeyFor(latitude: number, longitude: number): string {
  const row = Math.floor(latitude / CELL_SIZE_DEG);
  const col = Math.floor(longitude / CELL_SIZE_DEG);
  return `${row}:${col}`;
}

/**
 * Stations near a point for an app. The viewer's position is rounded to a
 * grid cell; if that cell was fetched within the TTL, only the DB is read.
 * Otherwise (and within budget) Google is asked once for a radius covering
 * the cell and its neighbours, results are upserted, and the cell is
 * stamped. Google prices only overwrite a user-submitted price when
 * Google's "as of" time is newer.
 */
export async function getNearbyStations(
  appId: string,
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<{ stations: NearbyStation[]; source: "google" | "osm" | "cache" | "none" }> {
  const admin = createAdminClient();
  const cellKey = cellKeyFor(latitude, longitude);

  const { data: cell } = await admin
    .from("gas_fetch_cells")
    .select("fetched_at")
    .eq("app_id", appId)
    .eq("cell_key", cellKey)
    .maybeSingle();

  const fresh = cell && Date.now() - new Date(cell.fetched_at).getTime() < CELL_TTL_MS;
  let source: "google" | "osm" | "cache" | "none" = fresh ? "cache" : "none";

  if (!fresh) {
    // Fetch a little beyond the shown radius so neighbouring cells are
    // pre-warmed and a viewer at the cell's edge still sees everything.
    const fetchRadiusMeters = Math.max(radiusMiles * 1609.34 * 1.5, 2500);
    if (isGoogleConfigured() && (await consumeBudget(appId))) {
      try {
        const found = await fetchGoogleStations(latitude, longitude, fetchRadiusMeters);
        await upsertGoogleStations(appId, found);
        source = "google";
      } catch (error) {
        console.error("Google station fetch failed:", error);
      }
    } else if (!isGoogleConfigured()) {
      try {
        const found = await fetchOverpassStations(latitude, longitude, fetchRadiusMeters);
        await upsertOverpassStations(appId, found);
        source = "osm";
      } catch (error) {
        console.error("Overpass station fetch failed:", error);
      }
    }
    if (source !== "none") {
      await admin
        .from("gas_fetch_cells")
        .upsert({ app_id: appId, cell_key: cellKey, fetched_at: new Date().toISOString() });
    }
  }

  // Read back everything within a bounding box, then filter by true distance.
  const latPad = radiusMiles / 69;
  const lngPad = radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180));
  const { data: rows } = await admin
    .from("gas_stations")
    .select("*")
    .eq("app_id", appId)
    .gte("latitude", latitude - latPad)
    .lte("latitude", latitude + latPad)
    .gte("longitude", longitude - lngPad)
    .lte("longitude", longitude + lngPad);

  const stations = (rows ?? [])
    .map((row) => toNearby(row, latitude, longitude))
    .filter((s) => s.distanceMiles <= radiusMiles);

  return { stations, source };
}

function toNearby(row: StationRow, latitude: number, longitude: number): NearbyStation {
  const grades: FuelGrade[] = ["regular", "midgrade", "premium", "diesel"];
  const prices: NearbyStation["prices"] = {};
  for (const g of grades) {
    const price = row[`price_${g}` as const];
    if (price !== null) prices[g] = { price: Number(price), updatedAt: row.price_updated[g] ?? null };
  }
  return {
    id: row.id,
    name: row.station_name,
    brand: row.brand,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceMiles: calculateHaversineMiles(latitude, longitude, row.latitude, row.longitude),
    prices,
    priceSource: row.price_source,
  };
}

/** Increments today's counter; false if the app is over budget. */
async function consumeBudget(appId: string): Promise<boolean> {
  const admin = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("gas_fetch_budget")
    .select("calls")
    .eq("app_id", appId)
    .eq("day", day)
    .maybeSingle();
  const calls = data?.calls ?? 0;
  if (calls >= DAILY_CALL_BUDGET) {
    console.warn(`Gas fetch budget exhausted for app ${appId} (${calls}/${DAILY_CALL_BUDGET})`);
    return false;
  }
  await admin.from("gas_fetch_budget").upsert({ app_id: appId, day, calls: calls + 1 });
  return true;
}

async function upsertGoogleStations(
  appId: string,
  found: Awaited<ReturnType<typeof fetchGoogleStations>>
): Promise<void> {
  if (found.length === 0) return;
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("gas_stations")
    .select("id, google_place_id, price_updated, price_source, price_regular, price_midgrade, price_premium, price_diesel")
    .eq("app_id", appId)
    .in(
      "google_place_id",
      found.map((f) => f.placeId)
    );
  const byPlaceId = new Map((existing ?? []).map((e) => [e.google_place_id, e]));

  for (const f of found) {
    const prev = byPlaceId.get(f.placeId);
    const priceUpdated: Partial<Record<FuelGrade, string>> = { ...(prev?.price_updated ?? {}) };
    const patch: Database["public"]["Tables"]["gas_stations"]["Update"] = {
      app_id: appId,
      google_place_id: f.placeId,
      station_name: f.name,
      brand: f.brand,
      address: f.address,
      latitude: f.latitude,
      longitude: f.longitude,
    };
    let anyGooglePrice = false;
    for (const grade of ["regular", "midgrade", "premium", "diesel"] as const) {
      const g = f.prices[grade];
      if (!g) continue;
      const prevAt = priceUpdated[grade] ? new Date(priceUpdated[grade]!).getTime() : 0;
      // A driver's submission stands until Google has something newer.
      if (prev?.price_source === "user" && prevAt >= new Date(g.updatedAt).getTime()) continue;
      patch[`price_${grade}` as const] = g.price;
      priceUpdated[grade] = g.updatedAt;
      anyGooglePrice = true;
    }
    patch.price_updated = priceUpdated;
    if (anyGooglePrice) patch.price_source = "google";
    if (prev) {
      await admin.from("gas_stations").update(patch).eq("id", prev.id);
    } else {
      await admin.from("gas_stations").insert({ ...patch, app_id: appId, station_name: f.name, latitude: f.latitude, longitude: f.longitude });
    }
  }
}

async function upsertOverpassStations(
  appId: string,
  found: Awaited<ReturnType<typeof fetchOverpassStations>>
): Promise<void> {
  if (found.length === 0) return;
  const admin = createAdminClient();
  // OSM ids are stored in google_place_id's slot with a prefix so the
  // (app_id, id) uniqueness still dedupes across fetches.
  const rows = found.map((f) => ({
    app_id: appId,
    google_place_id: `osm:${f.osmId}`,
    station_name: f.name,
    brand: f.brand,
    address: f.address,
    latitude: f.latitude,
    longitude: f.longitude,
  }));
  await admin.from("gas_stations").upsert(rows, { onConflict: "app_id,google_place_id", ignoreDuplicates: true });
}
