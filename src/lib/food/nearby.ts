import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateHaversineMiles } from "@/lib/listings/travel";
import { fetchGooglePlaces, isGoogleConfigured, type GooglePlace } from "@/lib/food/google";
import { CUISINE_BY_KEY, cuisineLabelFor, cuisineOf } from "@/lib/food/cuisines";
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
  phoneNational: string | null;
  phoneInternational: string | null;
  website: string | null;
  /** Most recent crowd-sourced wait report within WAIT_REPORT_TTL_MS. */
  wait: { minutes: number; reportedAt: string } | null;
}

/** Opening hours change rarely, and status is computed live from them, so
 * a fetched (cell, group) is trusted for a week. */
const CELL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Hard ceiling on Google calls per app per day. A new cell costs one call
 * (the general sweep), five more in a busy area (POPULAR_GROUPS), and one
 * per other cuisine someone actually taps. */
const DAILY_CALL_BUDGET = 200;
/** The general "any restaurant" sweep's group key in food_fetch_cells. */
const ALL_GROUP = "all";
/** Searched alongside the general sweep where an area is busy (see
 * POPULAR_FANOUT_AT): the cuisines people tap most. */
const POPULAR_GROUPS: CuisineKey[] = ["burgers", "pizza", "mexican", "vietnamese", "dessert"];
/** A general sweep returns at most 20 places. An area with about that many
 * stored in range (counted before closed places and shops are filtered
 * out) has more than one search can show, so the first visit there also
 * runs POPULAR_GROUPS; a quieter area is complete after one call. */
const POPULAR_FANOUT_AT = 18;
/** Google's cuisine searches also return shops that sell food (a 7-Eleven
 * comes back from the pizza search). Not what "food near me" means. */
const NOT_A_RESTAURANT = new Set([
  "convenience_store",
  "gas_station",
  "grocery_store",
  "supermarket",
  "liquor_store",
  "drugstore",
  "pharmacy",
  "department_store",
  "discount_store",
  "warehouse_store",
]);
/** ~1 mile at Seattle's latitude; the grid Google results are cached on. */
const CELL_SIZE_DEG = 0.015;
/** A wait-time report is shown for this long, then the card just says Open. */
export const WAIT_REPORT_TTL_MS = 90 * 60 * 1000;

export function cellKeyFor(latitude: number, longitude: number): string {
  const row = Math.floor(latitude / CELL_SIZE_DEG);
  const col = Math.floor(longitude / CELL_SIZE_DEG);
  return `${row}:${col}`;
}

export interface NearbyResult {
  places: NearbyPlace[];
  source: "google" | "cache" | "none";
  /** Cuisine pills whose Google search is fresh for this cell — the client
   * can skip re-asking for those. */
  fetchedCuisines: CuisineKey[];
}

/**
 * Restaurants near a point for an app. The viewer's position is rounded to
 * a ~1 mile grid cell. The general sweep (20 nearest restaurants) is
 * fetched once per cell per week. Where that comes back full the area is
 * busier than one search shows, so the popular cuisines are searched too,
 * once; a quiet area costs one call. Any other cuisine's own search (its
 * Google types, 20 nearest) runs only when `cuisine` is asked for.
 * Everything ever fetched for the area is returned regardless of
 * `cuisine`; the client filters.
 */
export async function getNearbyPlaces(
  appId: string,
  latitude: number,
  longitude: number,
  radiusMiles: number,
  cuisine: CuisineKey | null = null
): Promise<NearbyResult> {
  const admin = createAdminClient();
  const cellKey = cellKeyFor(latitude, longitude);

  const { data: cells } = await admin
    .from("food_fetch_cells")
    .select("fetch_group, fetched_at")
    .eq("app_id", appId)
    .eq("cell_key", cellKey);
  const freshGroups = new Set(
    (cells ?? []).filter((c) => Date.now() - new Date(c.fetched_at).getTime() < CELL_TTL_MS).map((c) => c.fetch_group)
  );

  let source: NearbyResult["source"] = "cache";
  const fetchRadiusMeters = Math.max(radiusMiles * 1609.34 * 1.25, 2000);

  /** Runs the searches for `groups` that aren't fresh yet, in parallel, as far as the budget allows. */
  async function fetchGroups(groups: Array<{ group: string; types: string[] }>) {
    const todo = groups.filter((g) => !freshGroups.has(g.group));
    if (todo.length === 0) return;
    if (!isGoogleConfigured()) {
      if (!freshGroups.size) source = "none";
      return;
    }
    // Budget is taken one call at a time (a read-then-write counter), then the searches run together.
    const allowed: typeof todo = [];
    for (const g of todo) {
      if (!(await consumeBudget(appId))) break;
      allowed.push(g);
    }
    if (allowed.length === 0) {
      if (!freshGroups.size) source = "none";
      return;
    }
    await Promise.all(
      allowed.map(async ({ group, types }) => {
        try {
          const found = await fetchGooglePlaces(latitude, longitude, fetchRadiusMeters, types);
          await upsertGooglePlaces(appId, found);
          await admin
            .from("food_fetch_cells")
            .upsert({ app_id: appId, cell_key: cellKey, fetch_group: group, fetched_at: new Date().toISOString() });
          freshGroups.add(group);
          source = "google";
        } catch (error) {
          console.error(`Google place fetch failed (${group}):`, error);
        }
      })
    );
  }

  let stored = 0;
  async function placesInRange() {
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
    // Everything stored for the area, before the filters: what tells a busy area from a quiet one.
    stored = (rows ?? []).filter((r) => calculateHaversineMiles(latitude, longitude, r.latitude, r.longitude) <= radiusMiles).length;
    return (rows ?? [])
      .filter((r) => r.business_status === null || r.business_status === "OPERATIONAL")
      .filter((r) => !r.primary_type || !NOT_A_RESTAURANT.has(r.primary_type))
      .map((row) => ({ row, distanceMiles: calculateHaversineMiles(latitude, longitude, row.latitude, row.longitude) }))
      .filter((x) => x.distanceMiles <= radiusMiles);
  }

  await fetchGroups([
    { group: ALL_GROUP, types: ["restaurant"] },
    ...(cuisine ? [{ group: cuisine, types: CUISINE_BY_KEY[cuisine].types }] : []),
  ]);
  let inRange = await placesInRange();

  // A busy area: one search can't show it all, so fill in the popular cuisines once.
  const missingPopular = POPULAR_GROUPS.filter((g) => !freshGroups.has(g));
  if (stored >= POPULAR_FANOUT_AT && missingPopular.length > 0) {
    await fetchGroups(missingPopular.map((g) => ({ group: g, types: CUISINE_BY_KEY[g].types })));
    inRange = await placesInRange();
  }

  const waits = await latestWaits(appId, inRange.map((x) => x.row.id));

  const places = inRange.map(({ row, distanceMiles }) => toNearby(row, distanceMiles, waits.get(row.id) ?? null));
  const fetchedCuisines = [...freshGroups].filter((g): g is CuisineKey => g !== ALL_GROUP && g in CUISINE_BY_KEY);
  return { places, source, fetchedCuisines };
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
    phoneNational: row.phone_national,
    phoneInternational: row.phone_international,
    website: row.website,
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
    phone_national: p.phoneNational,
    phone_international: p.phoneInternational,
    website: p.website,
    google_synced_at: now,
  }));
  const { error } = await admin.from("food_places").upsert(rows, { onConflict: "app_id,google_place_id" });
  if (error) console.error("food_places upsert failed:", error.message);
}
