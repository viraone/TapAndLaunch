import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { getNearbyPlaces } from "@/lib/food/nearby";
import { CUISINE_KEYS } from "@/lib/food/cuisines";

const NearbySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMiles: z.number().min(0.5).max(10).default(2),
  /** A pill the viewer tapped: makes sure that cuisine's own search has
   * been run for this area (one Google call, once a week). */
  cuisine: z.enum(CUISINE_KEYS).optional(),
});

/**
 * Restaurants around the viewer's live position, with hours so the client
 * can compute open/closed itself. The GPS fix is sent here — never to
 * Google — so the API key stays server-side, and the per-cell cache in
 * lib/food/nearby.ts means most calls never reach Google at all.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = NearbySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { latitude, longitude, radiusMiles, cuisine } = parsed.data;
  const result = await getNearbyPlaces(published.app.id, latitude, longitude, radiusMiles, cuisine ?? null);
  return Response.json(result);
}
