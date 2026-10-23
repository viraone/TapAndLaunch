// The weekly request window for a showcase: open from `opens` (e.g. Friday
// 9:40 PM, right after the show) until `closes` (e.g. Thursday 10:00 PM),
// in the show's own time zone. Everything here takes `now` so it can be
// tested without faking the clock.

export interface WeeklyWindow {
  timeZone: string;
  /** 0 = Sunday … 6 = Saturday; minutes after local midnight. */
  opensWeekday: number;
  opensMinutes: number;
  closesWeekday: number;
  closesMinutes: number;
  /** The weekday the show itself is on (Friday for Read The Room). */
  showWeekday: number;
  /** When the lineup may be shown, if not show day 6:00 AM (e.g. Thursday 11:30 PM, once the host has finished
   * selecting). Must fall inside the closed window; it runs until requests reopen. */
  lineupFromWeekday?: number;
  lineupFromMinutes?: number;
  /** One-off: requests stay closed until this moment even if the weekly window says open (e.g. reopen Saturday
   * noon instead of Friday 9:40 PM after one show). Expires by itself; the week after, the weekly times apply. */
  closedUntil?: Date;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK = 7 * 1440;

interface LocalTime {
  weekday: number;
  minutes: number;
  year: number;
  month: number;
  day: number;
}

function localTime(now: Date, timeZone: string): LocalTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    weekday: WEEKDAYS.indexOf(parts.weekday),
    minutes: (Number(parts.hour) % 24) * 60 + Number(parts.minute),
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

/** Minutes since Sunday midnight, local time. */
function weekMinute(weekday: number, minutes: number): number {
  return weekday * 1440 + minutes;
}

/** Is `now` inside the one-off hold (see `closedUntil`)? The hold covers the closed stretch that ends just before
 * `closedUntil` and the open time that would normally follow it: from the last weekly close before `closedUntil`
 * until `closedUntil`. Earlier weeks (and the weeks after) are untouched. */
export function isHeldClosed(w: WeeklyWindow, now: Date = new Date()): boolean {
  if (!(w.closedUntil instanceof Date) || Number.isNaN(w.closedUntil.getTime()) || now >= w.closedUntil) return false;
  const t = localTime(now, w.timeZone);
  const at = weekMinute(t.weekday, t.minutes);
  const closes = weekMinute(w.closesWeekday, w.closesMinutes);
  // Minutes until the next weekly close (a whole week when we're at the close itself).
  const untilClose = (closes - at + WEEK) % WEEK || WEEK;
  const nextClose = now.getTime() + untilClose * 60_000;
  return nextClose > w.closedUntil.getTime();
}

/** The weekly window alone, ignoring a one-off hold. */
function isWeeklyOpen(w: WeeklyWindow, now: Date): boolean {
  const t = localTime(now, w.timeZone);
  const at = weekMinute(t.weekday, t.minutes);
  const opens = weekMinute(w.opensWeekday, w.opensMinutes);
  const closes = weekMinute(w.closesWeekday, w.closesMinutes);
  // Distance from the opening, wrapping around the week; open until the
  // close comes round.
  return (at - opens + WEEK) % WEEK < (closes - opens + WEEK) % WEEK;
}

export function isWindowOpen(w: WeeklyWindow, now: Date = new Date()): boolean {
  return isWeeklyOpen(w, now) && !isHeldClosed(w, now);
}

/** Calendar date (local to the show) of the show that requests are for right
 * now: while open, the first show day after the window closes; while closed,
 * the show that's coming up (tonight, on show day). */
export function showDateFor(w: WeeklyWindow, now: Date = new Date()): { year: number; month: number; day: number } {
  const t = localTime(now, w.timeZone);
  let days: number;
  if (isWeeklyOpen(w, now)) {
    const at = weekMinute(t.weekday, t.minutes);
    const closes = weekMinute(w.closesWeekday, w.closesMinutes);
    const daysToClose = Math.floor((t.minutes + ((closes - at + WEEK) % WEEK)) / 1440);
    const closeWeekday = (t.weekday + daysToClose) % 7;
    days = daysToClose + ((w.showWeekday - closeWeekday + 7) % 7);
  } else {
    days = (w.showWeekday - t.weekday + 7) % 7;
  }
  // Plain calendar arithmetic on the local date, done in UTC so DST never
  // shifts the day.
  const d = new Date(Date.UTC(t.year, t.month - 1, t.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** "Friday, Oct 3" */
export function formatShowDate(date: { year: number; month: number; day: number }): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(date.year, date.month - 1, date.day))
  );
}

/** Is it the show's own day (Friday)? Used while requests are closed. */
export function isShowDay(w: WeeklyWindow, now: Date = new Date()): boolean {
  return localTime(now, w.timeZone).weekday === w.showWeekday;
}

/** The lineup is shown from this time on show day (6:00 AM, like the old site). */
export const LINEUP_FROM_MINUTES = 6 * 60;

/** From show day 6:00 AM (or the window's own `lineupFrom`) until requests reopen: the lineup (and each comic's
 * own status) may be shown. Before that, closed means closed. */
export function isLineupTime(w: WeeklyWindow, now: Date = new Date()): boolean {
  if (isWindowOpen(w, now)) return false;
  const t = localTime(now, w.timeZone);
  const at = weekMinute(t.weekday, t.minutes);
  const from = weekMinute(w.lineupFromWeekday ?? w.showWeekday, w.lineupFromMinutes ?? LINEUP_FROM_MINUTES);
  const opens = weekMinute(w.opensWeekday, w.opensMinutes);
  // Inside [from, opens), wrapping around the week.
  return (at - from + WEEK) % WEEK < (opens - from + WEEK) % WEEK;
}

/** "after tonight's show" on show day, "after tomorrow's show" the night before; during a one-off hold, the
 * moment requests reopen ("Saturday at 12:00 PM"). */
export function reopenLabel(w: WeeklyWindow, now: Date = new Date()): string {
  if (isHeldClosed(w, now) && w.closedUntil) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: w.timeZone, weekday: "long", hour: "numeric", minute: "2-digit" })
        .formatToParts(w.closedUntil)
        .map((p) => [p.type, p.value])
    );
    return `${parts.weekday} at ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
  }
  return isShowDay(w, now) ? "after tonight's show" : "after tomorrow's show";
}

/** "Fri 9:40 PM" */
export function formatWeekTime(weekday: number, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${WEEKDAYS[weekday]} ${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
