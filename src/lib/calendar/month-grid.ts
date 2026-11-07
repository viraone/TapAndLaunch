// Pure helpers for a month-calendar view of events: the grid of weeks for a month, and events
// grouped by the calendar day they fall on in a given time zone. No local-time Date methods
// anywhere, so the machine's zone and DST can never shift a day.

export const DEFAULT_CALENDAR_TIME_ZONE = "America/Los_Angeles";

export type CalendarDay = { key: string; day: number; inMonth: boolean };

const DAY_MS = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function keyOfUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function partsIn(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The calendar date of `when` as seen in `timeZone`, "YYYY-MM-DD"; null for an invalid date. */
export function dayKey(when: string | Date, timeZone: string): string | null {
  const date = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return partsIn(date, timeZone);
  } catch (e) {
    if (e instanceof RangeError) return partsIn(date, DEFAULT_CALENDAR_TIME_ZONE);
    throw e;
  }
}

/** Weeks (Sunday first, 7 cells each) covering `month` (0-11); cells outside it carry inMonth false. */
export function monthGrid(year: number, month: number): CalendarDay[][] {
  const first = Date.UTC(year, month, 1);
  const last = Date.UTC(year, month + 1, 0);
  const start = first - new Date(first).getUTCDay() * DAY_MS;
  const end = last + (6 - new Date(last).getUTCDay()) * DAY_MS;
  const rows: CalendarDay[][] = [];
  for (let ms = start; ms <= end; ms += 7 * DAY_MS) {
    const row: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const cell = new Date(ms + i * DAY_MS);
      row.push({
        key: keyOfUtc(cell.getTime()),
        day: cell.getUTCDate(),
        inMonth: cell.getUTCMonth() === month && cell.getUTCFullYear() === year,
      });
    }
    rows.push(row);
  }
  return rows;
}

/** Calendar-month arithmetic with year rollover; `month` is 0-11, `delta` may be negative. */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** "2026-11-28" -> { year: 2026, month: 10 }. */
export function monthOfKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-");
  return { year: Number(y), month: Number(m) - 1 };
}

/** (2026, 10) -> "November 2026". */
export function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 1)),
  );
}

/** Events keyed by the day (in `timeZone`) they start on, input order kept; invalid dates are skipped. */
export function groupByDay<T extends { starts_at: string }>(events: T[], timeZone: string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const event of events) {
    const key = dayKey(event.starts_at, timeZone);
    if (key === null) continue;
    (out[key] ??= []).push(event);
  }
  return out;
}
