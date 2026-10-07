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
  // Public, read-only data; other sites (the owner's dashboard page) may read it too. The schedules change once a night
  // (the reader job) and the week is close to a megabyte, so the CDN keeps a copy for five minutes and hands it out in
  // milliseconds; a browser never keeps its own (max-age=0), so a reopened page still asks the CDN.
  return Response.json(week, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600", "Access-Control-Allow-Origin": "*" },
  });
}
