import type { StarterEvent } from "@/lib/apps/templates";

/** Sample classes are placed in this zone until the owner edits them (most customers are on US Pacific time). */
export const SAMPLE_TIME_ZONE = "America/Los_Angeles";

function partsIn(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** The UTC moment for a wall-clock time in a time zone (handles daylight saving). */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const seen = partsIn(new Date(guess), timeZone);
  const offset = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute) - guess;
  return new Date(guess - offset);
}

/** Database rows for a starter's sample events, dated from today in `timeZone`. */
export function sampleEventRows(appId: string, events: StarterEvent[], now: Date = new Date(), timeZone = SAMPLE_TIME_ZONE) {
  const today = partsIn(now, timeZone);
  return events.map((e) => {
    const [hh = 0, mm = 0] = e.time.split(":").map(Number);
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + e.dayOffset));
    const start = zonedTimeToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh, mm, timeZone);
    return {
      app_id: appId,
      title: e.title,
      description: e.description,
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + e.minutes * 60_000).toISOString(),
      capacity: e.capacity,
    };
  });
}
