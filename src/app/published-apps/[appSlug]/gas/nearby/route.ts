import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { getNearbyStations } from "@/lib/gas/nearby";

const NearbySchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMiles: z.number().min(0.5).max(10).default(2),
});

/**
 * Stations around the viewer's live position. The browser sends its GPS
 * fix here — never to Google — so the API key stays server-side, and the
 * per-cell cache in lib/gas/nearby.ts means most calls never reach Google
 * at all.
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

  const { latitude, longitude, radiusMiles } = parsed.data;
  const result = await getNearbyStations(published.app.id, latitude, longitude, radiusMiles);
  return Response.json(result);
}
