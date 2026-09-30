import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateHaversineMiles } from "@/lib/listings/travel";
import { fetchGooglePlaces, isGoogleConfigured, type GooglePlace } from "@/lib/food/google";
import { CUISINES, cuisineLabelFor, cuisineOf } from "@/lib/food/cuisines";
import type { CuisineKey, Database, OpeningPeriod } from "@/types/database";

type PlaceRow = Database["public"]["Tables"]["food_places"]["Row"];

/** One restaurant as the published app renders it. Open/closed is *not*
 * included: the client computes it from `openingPeriods` +
 * `utcOffsetMinutes` (lib/food/hours.ts) so it stays live between fetches. */
export interface NearbyPlace {
  id: string;
  googlePlaceId: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  cuisine: CuisineKey | null;
  cuisineLabel: string;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  openingPeriods: OpeningPeriod[];
  weekdayDescriptions: string[];
  utcOffsetMinutes: number | null;
  /** Most recent crowd-sourced wait report within WAIT_REPORT_TTL_MS. */
  wait: { minutes: number; reportedAt: string } | null;
}

/** Opening hours change rarely, and status is computed live from them, so
 * a fetched cell is trusted for a day. */
const CELL_TTL_MS = 24 * 60 * 60 * 1000;
/** Hard ceiling on Google calls per app per day. One cell costs
 * CUISINES.length + 1 calls (one per cuisine plus a general sweep). */
const DAILY_CALL_BUDGET = 200;
/** ~1 mile at Seattle's latitude; the grid Google results are cached on. */
const CELL_SIZE_DEG = 0.015;
/** A wait-time report is shown for this long, then the card just says Open. */
export const WAIT_REPORT_TTL_MS = 90 * 60 * 1000;

export function cellKeyFor(latitude: number, longitude: number): string {
  const row = Math.floor(latitude / CELL_SIZE_DEG);
  const col = Math.floor(longitude / CELL_SIZE_DEG);
  return `${row}:${col}`;
}

export async function getNearbyPlaces(
  appId: string,
  latitude: number,
  longitude: number,
  radiusMiles: number
): Promise<{ places: NearbyPlace[]; source: "google" | "cache" | "none" }> {
  const admin = createAdminClient();
  const cellKey = cellKeyFor(latitude, longitude);

  const { data: cell } = await admin
    .from("food_fetch_cells")
    .select("fetched_at")
    .eq("app_id", appId)
    .eq("cell_key", cellKey)
    .maybeSingle();

  const fresh = cell && Date.now() - new Date(cell.fetched_at).getTime() < CELL_TTL_MS;
  let source: "google" | "cache" | "none" = fresh ? "cache" : "none";

  if (!fresh && isGoogleConfigured()) {
    const fetchRadiusMeters = Math.max(radiusMiles * 1609.34 * 1.25, 2000);
    // One search per cuisine so each quick-filter has real coverage, then
    // a general sweep for everything else. Each is one budget unit.
    const searches: string[][] = [...CUISINES.map((c) => c.types), ["restaurant"]];
    const found = new Map<string, GooglePlace>();
    let anyCall = false;
    for (const includedTypes of searches) {
      if (!(await consumeBudget(appId))) break;
      anyCall = true;
      try {
        for (const p of await fetchGooglePlaces(latitude, longitude, fetchRadiusMeters, includedTypes)) {
          found.set(p.placeId, p);
        }
      } catch (error) {
        console.error("Google place fetch failed:", error);
      }
    }
    if (anyCall) {
      await upsertGooglePlaces(appId, [...found.values()]);
      await admin
        .from("food_fetch_cells")
        .upsert({ app_id: appId, cell_key: cellKey, fetched_at: new Date().toISOString() });
      source = "google";
    }
  }

  const latPad = radiusMiles / 69;
  const lngPad = radiusMiles / (69 * Math.cos((latitude * Math.PI) / 180));
  const { data: rows } = await admin
    .from("food_places")
    .select("*")
    .eq("app_id", appId)
    .gte("latitude", latitude - latPad)
    .lte("latitude", latitude + latPad)
    .gte("longitude", longitude - lngPad)
    .lte("longitude", longitude + lngPad);

  const inRange = (rows ?? [])
    .filter((r) => r.business_status === null || r.business_status === "OPERATIONAL")
    .map((row) => ({ row, distanceMiles: calculateHaversineMiles(latitude, longitude, row.latitude, row.longitude) }))
    .filter((x) => x.distanceMiles <= radiusMiles);

  const waits = await latestWaits(appId, inRange.map((x) => x.row.id));

  const places = inRange.map(({ row, distanceMiles }) => toNearby(row, distanceMiles, waits.get(row.id) ?? null));
  return { places, source };
}

function toNearby(row: PlaceRow, distanceMiles: number, wait: NearbyPlace["wait"]): NearbyPlace {
  const classify = { types: row.types, primaryType: row.primary_type, name: row.name };
  return {
    id: row.id,
    googlePlaceId: row.google_place_id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceMiles,
    cuisine: cuisineOf(classify),
    cuisineLabel: cuisineLabelFor(classify),
    rating: row.rating === null ? null : Number(row.rating),
    ratingCount: row.rating_count,
    priceLevel: row.price_level,
    openingPeriods: row.opening_periods,
    weekdayDescriptions: row.weekday_descriptions,
    utcOffsetMinutes: row.utc_offset_minutes,
    wait,
  };
}

/** The newest report per place within the TTL. */
async function latestWaits(appId: string, placeIds: string[]): Promise<Map<string, NearbyPlace["wait"]>> {
  const result = new Map<string, NearbyPlace["wait"]>();
  if (placeIds.length === 0) return result;
  const admin = createAdminClient();
  const since = new Date(Date.now() - WAIT_REPORT_TTL_MS).toISOString();
  const { data } = await admin
    .from("food_wait_reports")
    .select("place_id, wait_minutes, reported_at")
    .eq("app_id", appId)
    .in("place_id", placeIds)
    .gte("reported_at", since)
    .order("reported_at", { ascending: false });
  for (const r of data ?? []) {
    if (!result.has(r.place_id)) result.set(r.place_id, { minutes: r.wait_minutes, reportedAt: r.reported_at });
  }
  return result;
}

/** Increments today's counter; false if the app is over budget. */
async function consumeBudget(appId: string): Promise<boolean> {
  const admin = createAdminClient();
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("food_fetch_budget")
    .select("calls")
    .eq("app_id", appId)
    .eq("day", day)
    .maybeSingle();
  const calls = data?.calls ?? 0;
  if (calls >= DAILY_CALL_BUDGET) {
    console.warn(`Food fetch budget exhausted for app ${appId} (${calls}/${DAILY_CALL_BUDGET})`);
    return false;
  }
  await admin.from("food_fetch_budget").upsert({ app_id: appId, day, calls: calls + 1 });
  return true;
}

async function upsertGooglePlaces(appId: string, found: GooglePlace[]): Promise<void> {
  if (found.length === 0) return;
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const rows: Database["public"]["Tables"]["food_places"]["Insert"][] = found.map((p) => ({
    app_id: appId,
    google_place_id: p.placeId,
    name: p.name,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
    primary_type: p.primaryType,
    types: p.types,
    rating: p.rating,
    rating_count: p.ratingCount,
    price_level: p.priceLevel,
    opening_periods: p.openingPeriods,
    weekday_descriptions: p.weekdayDescriptions,
    utc_offset_minutes: p.utcOffsetMinutes,
    business_status: p.businessStatus,
    google_synced_at: now,
  }));
  const { error } = await admin.from("food_places").upsert(rows, { onConflict: "app_id,google_place_id" });
  if (error) console.error("food_places upsert failed:", error.message);
}
