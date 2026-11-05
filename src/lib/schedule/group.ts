import { localDateOf } from "./recurrence";

/** The local calendar date ("YYYY-MM-DD") a visit starts on in the app's zone. */
function visitDate(visit: { starts_at: string }, timeZone: string): string {
  return localDateOf(new Date(visit.starts_at), timeZone);
}

function startsAtMs(visit: { starts_at: string }): number {
  return new Date(visit.starts_at).getTime();
}

/**
 * Groups visits by the calendar day they start on, in the app's time zone.
 * Days and the visits inside each day are oldest first.
 */
export function groupVisitsByDay<T extends { starts_at: string }>(
  visits: T[],
  timeZone: string
): { date: string; visits: T[] }[] {
  const byDate = new Map<string, T[]>();

  for (const visit of visits) {
    const date = visitDate(visit, timeZone);
    const bucket = byDate.get(date);
    if (bucket) bucket.push(visit);
    else byDate.set(date, [visit]);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayVisits]) => ({
      date,
      visits: [...dayVisits].sort((a, b) => startsAtMs(a) - startsAtMs(b)),
    }));
}

/**
 * Splits visits into the ones still to come and the ones already past, using
 * local days: a visit is upcoming when its local date is today or later.
 * The input order is kept inside each half.
 */
export function splitUpcoming<T extends { starts_at: string }>(
  visits: T[],
  timeZone: string,
  now: Date
): { upcoming: T[]; earlier: T[] } {
  const today = localDateOf(now, timeZone);
  const upcoming: T[] = [];
  const earlier: T[] = [];

  for (const visit of visits) {
    if (visitDate(visit, timeZone) >= today) upcoming.push(visit);
    else earlier.push(visit);
  }

  return { upcoming, earlier };
}
