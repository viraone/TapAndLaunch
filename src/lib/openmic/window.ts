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

export function isWindowOpen(w: WeeklyWindow, now: Date = new Date()): boolean {
  const t = localTime(now, w.timeZone);
  const at = weekMinute(t.weekday, t.minutes);
  const opens = weekMinute(w.opensWeekday, w.opensMinutes);
  const closes = weekMinute(w.closesWeekday, w.closesMinutes);
  // Distance from the opening, wrapping around the week; open until the
  // close comes round.
  return (at - opens + WEEK) % WEEK < (closes - opens + WEEK) % WEEK;
}

/** Calendar date (local to the show) of the show that requests are for right
 * now: while open, the first show day after the window closes; while closed,
 * the show that's coming up (tonight, on show day). */
export function showDateFor(w: WeeklyWindow, now: Date = new Date()): { year: number; month: number; day: number } {
  const t = localTime(now, w.timeZone);
  let days: number;
  if (isWindowOpen(w, now)) {
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

/** "Fri 9:40 PM" */
export function formatWeekTime(weekday: number, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${WEEKDAYS[weekday]} ${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
