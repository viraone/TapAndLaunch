import type { OpeningPeriod } from "@/types/database";

/**
 * Live open/closed status from Google's weekly `regularOpeningHours.periods`
 * evaluated in the *place's* local time (via its UTC offset). Pure and
 * client-safe: the published app re-runs this every 30 s so "Closing in
 * 12 min" counts down without any network call.
 *
 * Time is modelled as "minutes since Sunday 00:00" in the place's local
 * week (0 … 10079). A period that closes on a later day (or past midnight)
 * simply has close > open; one that wraps the week boundary is normalised
 * by adding a week to its close.
 */

export const WEEK_MINUTES = 7 * 24 * 60;
export const CLOSING_SOON_MINUTES = 30;

export type OpenStatus =
  | { state: "open"; closesInMinutes: number | null; closesAtLabel: string | null }
  | { state: "closing_soon"; closesInMinutes: number; closesAtLabel: string }
  | { state: "closed"; opensInMinutes: number | null; opensAtLabel: string | null }
  | { state: "unknown" };

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toWeekMinute(p: { day: number; hour: number; minute: number }): number {
  return p.day * 1440 + p.hour * 60 + p.minute;
}

/** "11 AM", "9:30 PM" */
export function formatClock(weekMinute: number): string {
  const m = ((weekMinute % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "AM" : "PM";
  return min === 0 ? `${h12} ${suffix}` : `${h12}:${String(min).padStart(2, "0")} ${suffix}`;
}

/** The place's local "now" as a week-minute. */
export function localWeekMinute(now: Date, utcOffsetMinutes: number): number {
  const shifted = new Date(now.getTime() + utcOffsetMinutes * 60_000);
  return (
    shifted.getUTCDay() * 1440 + shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  );
}

export function computeOpenStatus(
  periods: OpeningPeriod[] | null | undefined,
  utcOffsetMinutes: number | null | undefined,
  now: Date = new Date()
): OpenStatus {
  if (!periods || periods.length === 0 || utcOffsetMinutes === null || utcOffsetMinutes === undefined) {
    return { state: "unknown" };
  }

  // Open 24/7: Google encodes this as a single period opening Sunday 00:00
  // with no close.
  if (periods.length === 1 && !periods[0].close && periods[0].open.day === 0 && periods[0].open.hour === 0) {
    return { state: "open", closesInMinutes: null, closesAtLabel: null };
  }

  const nowW = localWeekMinute(now, utcOffsetMinutes);

  // Normalised [open, close) intervals, plus copies shifted by a week so a
  // "now" just after Sunday midnight still falls inside Saturday's late
  // hours.
  const intervals: Array<{ open: number; close: number }> = [];
  for (const p of periods) {
    const open = toWeekMinute(p.open);
    let close = p.close ? toWeekMinute(p.close) : open + 1440;
    if (close <= open) close += WEEK_MINUTES;
    intervals.push({ open, close }, { open: open + WEEK_MINUTES, close: close + WEEK_MINUTES }, { open: open - WEEK_MINUTES, close: close - WEEK_MINUTES });
  }

  const current = intervals.find((i) => nowW >= i.open && nowW < i.close);
  if (current) {
    const closesIn = current.close - nowW;
    const closesAtLabel = formatClock(current.close);
    if (closesIn <= CLOSING_SOON_MINUTES) {
      return { state: "closing_soon", closesInMinutes: closesIn, closesAtLabel };
    }
    return { state: "open", closesInMinutes: closesIn, closesAtLabel };
  }

  // Closed: find the next opening.
  let next: { open: number } | null = null;
  for (const i of intervals) {
    if (i.open > nowW && (!next || i.open < next.open)) next = i;
  }
  if (!next) return { state: "closed", opensInMinutes: null, opensAtLabel: null };
  const opensIn = next.open - nowW;
  const sameDay = Math.floor(((next.open % WEEK_MINUTES) + WEEK_MINUTES) % WEEK_MINUTES / 1440) === Math.floor(nowW / 1440);
  const clock = formatClock(next.open);
  const opensAtLabel = sameDay
    ? clock
    : `${DAY_SHORT[(((Math.floor(next.open / 1440)) % 7) + 7) % 7]} ${clock}`;
  return { state: "closed", opensInMinutes: opensIn, opensAtLabel };
}
