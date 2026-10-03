import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { orgHasMaps } from "@/lib/platform/maps";
import { MAPS_LOCKED_MESSAGE } from "@/lib/platform/maps-shared";
import { getPopularDishes } from "@/lib/food/popularDishes";

const DishesSchema = z.object({ placeId: z.string().uuid() });

/**
 * "Popular with diners" for one restaurant the viewer opened. The Google key stays server-side, the
 * answer is remembered for 30 days, and a monthly cap keeps it inside Google's free allowance
 * (lib/food/popularDishes.ts). Never errors to the viewer for a missing answer: the sheet just
 * leaves the section out.
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

  const parsed = DishesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  return Response.json(await getPopularDishes(published.app.id, parsed.data.placeId));
}
