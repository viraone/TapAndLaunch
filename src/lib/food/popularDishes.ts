import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPlaceReviews, isGoogleConfigured } from "@/lib/food/google";
import { extractDishes, type PopularDish } from "@/lib/food/dishes";
import { cuisineOf } from "@/lib/food/cuisines";

/** A restaurant's dishes are re-read from Google reviews at most this often. */
export const DISHES_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Review text is Google's "Place Details Enterprise + Atmosphere" tier: 1,000 free calls a month, then
 * $25 per 1,000. Stop well short of the free allowance so this can never cost anything. At the cap
 * the dishes section just doesn't show until next month.
 */
export const MONTHLY_DISH_CALL_BUDGET = 800;

export type DishesResult =
  | { status: "ok"; dishes: PopularDish[] }
  | { status: "unavailable" };

/**
 * Increments this month's counter for Google's review-text calls (popular dishes and the reviews screen are the same
 * Google tier, so they share one counter); false if the app is at `ceiling`.
 */
export async function consumeDishBudget(appId: string, ceiling: number = MONTHLY_DISH_CALL_BUDGET): Promise<boolean> {
  const admin = createAdminClient();
  const month = new Date().toISOString().slice(0, 7);
  const { data } = await admin.from("food_dish_budget").select("calls").eq("app_id", appId).eq("month", month).maybeSingle();
  const calls = data?.calls ?? 0;
  if (calls >= ceiling) {
    console.warn(`Food dish budget exhausted for app ${appId} (${calls}/${ceiling})`);
    return false;
  }
  await admin.from("food_dish_budget").upsert({ app_id: appId, month, calls: calls + 1 });
  return true;
}

/**
 * The popular dishes for one stored restaurant. Served from the 30-day memory when fresh (an empty
 * result is remembered too, so a place with nothing to show isn't re-fetched on every tap). Otherwise
 * one Google call, unless the monthly cap is reached or Google fails; then nothing is stored and the
 * client simply shows no dishes.
 */
export async function getPopularDishes(appId: string, placeRowId: string): Promise<DishesResult> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("food_places")
    .select("id, google_place_id, name, types, primary_type, popular_dishes, dishes_synced_at")
    .eq("app_id", appId)
    .eq("id", placeRowId)
    .maybeSingle();
  if (!row) return { status: "unavailable" };

  const fresh = row.dishes_synced_at !== null && Date.now() - new Date(row.dishes_synced_at).getTime() < DISHES_TTL_MS;
  if (fresh && row.popular_dishes) return { status: "ok", dishes: row.popular_dishes };

  if (!isGoogleConfigured()) return { status: "unavailable" };
  if (!(await consumeDishBudget(appId))) return { status: "unavailable" };

  try {
    const reviews = await fetchPlaceReviews(row.google_place_id);
    const dishes = extractDishes(reviews, cuisineOf({ types: row.types, primaryType: row.primary_type, name: row.name }));
    await admin
      .from("food_places")
      .update({ popular_dishes: dishes, dishes_synced_at: new Date().toISOString() })
      .eq("id", row.id);
    return { status: "ok", dishes };
  } catch (e) {
    console.error("popular dishes fetch failed:", e instanceof Error ? e.message : e);
    return { status: "unavailable" };
  }
}
