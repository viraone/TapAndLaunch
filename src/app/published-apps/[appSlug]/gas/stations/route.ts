import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";

const AddStationSchema = z.object({
  name: z.string().min(1).max(120),
  brand: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * "Add a station" from the app — a driver standing at a station Google/OSM
 * doesn't list. Coordinates come from their GPS. Crowd-sourced, so it's the
 * one way a station can exist with no external id.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = AddStationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: station, error } = await admin
    .from("gas_stations")
    .insert({
      app_id: published.app.id,
      station_name: parsed.data.name,
      brand: parsed.data.brand ?? null,
      address: parsed.data.address ?? null,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    })
    .select("id")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ stationId: station.id }, { status: 201 });
}
