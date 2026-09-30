import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/pwa/get-current-member";
import type { Database, FuelGrade } from "@/types/database";

const price = z.number().min(0.5).max(20).optional();
const PriceUpdateSchema = z.object({
  stationId: z.string().uuid(),
  regular: price,
  midgrade: price,
  premium: price,
  diesel: price,
});

/**
 * A driver's price submission. Only the grades sent are touched; each gets
 * "as of now" and the row is marked `price_source: 'user'`, which makes it
 * win over Google's next fetch until Google reports a newer time (see
 * lib/gas/nearby.ts). No rate limiting yet — same caveat as every other
 * public write in this repo.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = PriceUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const grades: FuelGrade[] = ["regular", "midgrade", "premium", "diesel"];
  const submitted = grades.filter((g) => parsed.data[g] !== undefined);
  if (submitted.length === 0) {
    return Response.json({ error: "Enter at least one price" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: station } = await admin
    .from("gas_stations")
    .select("id, price_updated")
    .eq("id", parsed.data.stationId)
    .eq("app_id", published.app.id)
    .maybeSingle();
  if (!station) {
    return Response.json({ error: "Station not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const priceUpdated = { ...station.price_updated };
  const patch: Database["public"]["Tables"]["gas_stations"]["Update"] = { price_source: "user" };
  for (const g of submitted) {
    patch[`price_${g}` as const] = parsed.data[g];
    priceUpdated[g] = now;
  }
  patch.price_updated = priceUpdated;

  const member = await getCurrentMember(published.app.id);
  const { error } = await admin.from("gas_stations").update(patch).eq("id", station.id);
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true, submittedBy: member?.id ?? null });
}
