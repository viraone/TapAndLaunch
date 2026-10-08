import { getPublishedApp } from "@/lib/pwa/data";
import { getClassWeek } from "@/lib/fitness/classes";
import { nextDays, seattleToday } from "@/lib/fitness/schedule";

/**
 * FitnessNav's week: every class the app's studios list for the next 7 days (Seattle time), read from their own
 * schedule pages by the morning job. No Google or other paid call happens here, so nothing is gated or capped.
 */
export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const today = seattleToday();
  // ?day=YYYY-MM-DD (one of the week's seven days): that day's classes alone, a seventh of the week. The page asks for
  // today this way first and the other days after, so the first list is on screen after one small answer.
  const day = new URL(request.url).searchParams.get("day");
  if (day && !nextDays(today, 7).includes(day)) {
    return Response.json({ error: "day must be one of the next 7 days (YYYY-MM-DD)" }, { status: 400 });
  }
  const week = await getClassWeek(published.app.id, today, day ?? undefined);
  // Public, read-only data; other sites (the owner's dashboard page) may read it too. The schedules change once a night
  // (the reader job) and the week is close to a megabyte, so the CDN keeps a copy for five minutes and hands it out in
  // milliseconds; a browser never keeps its own (max-age=0), so a reopened page still asks the CDN.
  return Response.json(week, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600", "Access-Control-Allow-Origin": "*" },
  });
}
