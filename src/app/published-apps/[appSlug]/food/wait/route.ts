import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";

const WaitReportSchema = z.object({
  placeId: z.string().uuid(),
  waitMinutes: z.number().int().min(0).max(240),
});

/**
 * A diner's wait-time report. Append-only; the runtime shows the newest
 * report per place for 90 minutes (lib/food/nearby.ts). No rate limiting
 * yet — same caveat as every other public write in this repo.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = WaitReportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: place } = await admin
    .from("food_places")
    .select("id")
    .eq("id", parsed.data.placeId)
    .eq("app_id", published.app.id)
    .maybeSingle();
  if (!place) {
    return Response.json({ error: "Place not found" }, { status: 404 });
  }

  const { error } = await admin.from("food_wait_reports").insert({
    app_id: published.app.id,
    place_id: place.id,
    wait_minutes: parsed.data.waitMinutes,
  });
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
