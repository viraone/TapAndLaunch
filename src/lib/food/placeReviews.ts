import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPlaceReviewList, isGoogleConfigured } from "@/lib/food/google";
import { consumeDishBudget } from "@/lib/food/popularDishes";
import { shapeReviews, type PlaceReview } from "@/lib/food/reviews";

/**
 * The reviews screen shares Google's review-text allowance (1,000 free a month) with popular dishes, whose own cap is 800.
 * Reviews stop at this lower line so people tapping ratings can never use up what popular dishes needs for the rest of the month.
 */
export const REVIEWS_MONTHLY_CEILING = 600;

export type ReviewsResult =
  | { status: "ok"; reviews: PlaceReview[] }
  | { status: "unavailable" };

/**
 * Google's most relevant reviews (up to 5) for one stored restaurant, fetched live when someone taps its rating. Google's terms
 * don't let us keep review text, so nothing is stored or remembered here (the client keeps it for the visit). If the monthly line
 * is reached or Google fails, the screen shows a link to the restaurant's Google Maps reviews instead, which costs nothing.
 */
export async function getPlaceReviews(appId: string, placeRowId: string): Promise<ReviewsResult> {
  const admin = createAdminClient();
  const { data: row } = await admin.from("food_places").select("google_place_id").eq("app_id", appId).eq("id", placeRowId).maybeSingle();
  if (!row) return { status: "unavailable" };
  if (!isGoogleConfigured()) return { status: "unavailable" };
  if (!(await consumeDishBudget(appId, REVIEWS_MONTHLY_CEILING))) return { status: "unavailable" };
  try {
    return { status: "ok", reviews: shapeReviews(await fetchPlaceReviewList(row.google_place_id)) };
  } catch (e) {
    console.error("place reviews fetch failed:", e instanceof Error ? e.message : e);
    return { status: "unavailable" };
  }
}
