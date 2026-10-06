import { getPublishedApp } from "@/lib/pwa/data";
import { getClassWeek } from "@/lib/fitness/classes";
import { seattleToday } from "@/lib/fitness/schedule";

/**
 * FitnessNav's week: every class the app's studios list for the next 7 days (Seattle time), read from their own
 * schedule pages by the morning job. No Google or other paid call happens here, so nothing is gated or capped.
 */
export async function GET(_request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const week = await getClassWeek(published.app.id, seattleToday());
  // Public, read-only data; other sites (the owner's dashboard page) may read it too.
  return Response.json(week, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
}
