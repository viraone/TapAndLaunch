export interface SeriesRule {
  startsOn: string;
  startTime: string;
  intervalWeeks: number;
  endsOn: string | null;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

interface WallParts {
  date: string;
  hour: string;
  minute: string;
  second: string;
}

function wallParts(ms: number, timeZone: string): WallParts {
  const parts = getFormatter(timeZone).formatToParts(new Date(ms));
  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function zoneOffsetMs(ms: number, timeZone: string): number {
  const parts = wallParts(ms, timeZone);
  const year = Number(parts.date.slice(0, 4));
  const month = Number(parts.date.slice(5, 7));
  const day = Number(parts.date.slice(8, 10));
  const asUtc = Date.UTC(
    year,
    month - 1,
    day,
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseDate(value: string): DateParts | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

function parseTime(value: string): TimeParts | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

function formatDate(ms: number): string {
  const date = new Date(ms);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return Number.NaN;
  return (
    (Date.UTC(b.year, b.month - 1, b.day) -
      Date.UTC(a.year, a.month - 1, a.day)) /
    DAY_MS
  );
}

function wallMatches(
  ms: number,
  date: string,
  time: TimeParts,
  timeZone: string
): boolean {
  const parts = wallParts(ms, timeZone);
  return (
    parts.date === date &&
    parts.hour === String(time.hour).padStart(2, "0") &&
    parts.minute === String(time.minute).padStart(2, "0") &&
    parts.second === String(time.second).padStart(2, "0")
  );
}

function resolveWallTime(
  guess: number,
  date: string,
  time: TimeParts,
  timeZone: string
): number | null {
  // The offsets one day either side cover both sides of a DST change.
  const offsets = [
    zoneOffsetMs(guess - DAY_MS, timeZone),
    zoneOffsetMs(guess + DAY_MS, timeZone),
  ];
  for (const offset of offsets) {
    const candidate = guess - offset;
    if (wallMatches(candidate, date, time, timeZone)) return candidate;
  }
  return null;
}

/** The UTC instant of a local wall-clock date + time in an IANA zone. */
export function zonedTimeToUtc(
  date: string,
  time: string,
  timeZone: string
): Date {
  const dateParts = parseDate(date);
  const timeParts = parseTime(time);
  if (!dateParts || !timeParts) {
    throw new Error("Invalid date or time");
  }
  const guess = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second
  );
  const resolved = resolveWallTime(guess, date, timeParts, timeZone);
  if (resolved !== null) return new Date(resolved);

  // Spring-forward gap: the wall time does not exist. Use the wall time one
  // hour later, which is the instant the clock jumps to.
  const later = new Date(guess + HOUR_MS);
  const laterDate = formatDate(later.getTime());
  const laterTime: TimeParts = {
    hour: later.getUTCHours(),
    minute: later.getUTCMinutes(),
    second: later.getUTCSeconds(),
  };
  const resolvedLater = resolveWallTime(
    later.getTime(),
    laterDate,
    laterTime,
    timeZone
  );
  if (resolvedLater !== null) return new Date(resolvedLater);
  return new Date(guess);
}

/**
 * Every occurrence start (UTC) with local date >= fromDate and <= untilDate
 * (both "YYYY-MM-DD", inclusive), oldest first.
 */
export function occurrencesBetween(
  rule: SeriesRule,
  fromDate: string,
  untilDate: string,
  timeZone: string
): Date[] {
  if (typeof rule !== "object" || rule === null) return [];
  if (
    !Number.isInteger(rule.intervalWeeks) ||
    rule.intervalWeeks < 1 ||
    rule.intervalWeeks > 12
  ) {
    return [];
  }
  const start = parseDate(rule.startsOn);
  const time = parseTime(rule.startTime);
  const from = parseDate(fromDate);
  const until = parseDate(untilDate);
  if (!start || !time || !from || !until) return [];
  if (
    rule.endsOn !== null &&
    rule.endsOn !== undefined &&
    !parseDate(rule.endsOn)
  ) {
    return [];
  }
  if (typeof timeZone !== "string") return [];
  try {
    getFormatter(timeZone);
  } catch {
    return [];
  }
  if (fromDate > untilDate) return [];

  const stepDays = rule.intervalWeeks * 7;
  const firstDiff = daysBetween(rule.startsOn, fromDate);
  let index = firstDiff <= 0 ? 0 : Math.ceil(firstDiff / stepDays);
  const occurrences: Date[] = [];
  while (occurrences.length < 500) {
    const date = addDays(rule.startsOn, index * stepDays);
    if (date > untilDate) break;
    if (
      rule.endsOn !== null &&
      rule.endsOn !== undefined &&
      date > rule.endsOn
    ) {
      break;
    }
    occurrences.push(zonedTimeToUtc(date, rule.startTime, timeZone));
    index += 1;
  }
  return occurrences;
}

/** "YYYY-MM-DD" of an instant in a zone. */
export function localDateOf(instant: Date, timeZone: string): string {
  return wallParts(instant.getTime(), timeZone).date;
}

/** Adds days to a "YYYY-MM-DD" (calendar arithmetic, no time zone). */
export function addDays(date: string, days: number): string {
  const parsed = parseDate(date);
  if (!parsed || !Number.isInteger(days)) {
    throw new Error("Invalid date");
  }
  return formatDate(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + days)
  );
}
