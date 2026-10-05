import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { orgHasMaps } from "@/lib/platform/maps";
import { MAPS_LOCKED_MESSAGE } from "@/lib/platform/maps-shared";
import { getPlaceReviews } from "@/lib/food/placeReviews";

const ReviewsSchema = z.object({ placeId: z.string().uuid() });

/**
 * Google's most relevant reviews for one restaurant the viewer opened and tapped the rating of. The Google key stays
 * server-side, the text is never stored, and a monthly cap keeps it inside Google's free allowance (lib/food/placeReviews.ts).
 * A missing answer is not an error: the screen falls back to a link to the restaurant's reviews on Google Maps.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await orgHasMaps(published.app.organization_id))) {
    return Response.json({ error: MAPS_LOCKED_MESSAGE }, { status: 403 });
  }
  const parsed = ReviewsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  return Response.json(await getPlaceReviews(published.app.id, parsed.data.placeId));
}
