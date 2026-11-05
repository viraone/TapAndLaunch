import { addDays, localDateOf, zonedTimeToUtc } from "@/lib/schedule/recurrence";

/**
 * The pure timing rules behind the owner's automations. No database and no network: the sender reads the rows and
 * asks these functions which occurrence is due. Times are the reminder's own local wall-clock times.
 */

export interface AutomationRule {
  scheduleKind: "weekly" | "once";
  /** 0 = Sunday … 6 = Saturday, for a weekly reminder. */
  weekday: number | null;
  /** "YYYY-MM-DD" local date, for a one-off reminder. */
  onceDate: string | null;
  /** "HH:MM" (or "HH:MM:SS" from Postgres) local wall-clock time. */
  sendTime: string;
  timeZone: string;
}

/** How long after its moment an occurrence may still be sent (the cron runs every five minutes). */
export const CATCH_UP_MINUTES = 90;

/** 0 = Sunday … 6 = Saturday. No time zone is involved once the local date is known. */
function weekdayOfDate(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isWeekday(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 0 && value <= 6;
}

/** The instant of one local date + time, or null when the rule holds an unreadable date or time. */
function occurrenceOn(rule: AutomationRule, date: string): Date | null {
  try {
    return zonedTimeToUtc(date, rule.sendTime, rule.timeZone);
  } catch {
    return null;
  }
}

/** The latest scheduled instant at or before `now`, or null (weekly: look back at most 7 local days; once: that one instant if it is not in the future). */
export function latestOccurrence(rule: AutomationRule, now: Date): Date | null {
  if (rule.scheduleKind === "once") {
    if (!rule.onceDate) return null;
    const occurrence = occurrenceOn(rule, rule.onceDate);
    return occurrence && occurrence.getTime() <= now.getTime() ? occurrence : null;
  }

  if (!isWeekday(rule.weekday)) return null;
  const today = localDateOf(now, rule.timeZone);
  for (let daysBack = 0; daysBack <= 7; daysBack += 1) {
    const date = addDays(today, -daysBack);
    if (weekdayOfDate(date) !== rule.weekday) continue;
    const occurrence = occurrenceOn(rule, date);
    if (occurrence && occurrence.getTime() <= now.getTime()) return occurrence;
  }
  return null;
}

/** The next scheduled instant strictly after `now`, or null for a "once" rule that has passed. */
export function nextOccurrence(rule: AutomationRule, now: Date): Date | null {
  if (rule.scheduleKind === "once") {
    if (!rule.onceDate) return null;
    const occurrence = occurrenceOn(rule, rule.onceDate);
    return occurrence && occurrence.getTime() > now.getTime() ? occurrence : null;
  }

  if (!isWeekday(rule.weekday)) return null;
  const today = localDateOf(now, rule.timeZone);
  for (let daysAhead = 0; daysAhead <= 7; daysAhead += 1) {
    const date = addDays(today, daysAhead);
    if (weekdayOfDate(date) !== rule.weekday) continue;
    const occurrence = occurrenceOn(rule, date);
    if (occurrence && occurrence.getTime() > now.getTime()) return occurrence;
  }
  return null;
}

/** True when the occurrence is within CATCH_UP_MINUTES before `now` (inclusive) and not before `activatedAt`. */
export function isOccurrenceDue(input: {
  occurrence: Date;
  now: Date;
  activatedAt: Date | null;
}): boolean {
  const elapsedMs = input.now.getTime() - input.occurrence.getTime();
  if (elapsedMs < 0 || elapsedMs > CATCH_UP_MINUTES * 60_000) return false;
  if (input.activatedAt && input.occurrence.getTime() < input.activatedAt.getTime()) return false;
  return true;
}

/** The local date ("YYYY-MM-DD") of the first show day on or after the occurrence's local date, given the show weekday (0..6). */
export function showDateAfter(
  occurrence: Date,
  showWeekday: number,
  timeZone: string
): string {
  const target = ((showWeekday % 7) + 7) % 7;
  let date = localDateOf(occurrence, timeZone);
  for (let daysAhead = 0; daysAhead < 7; daysAhead += 1) {
    if (weekdayOfDate(date) === target) return date;
    date = addDays(date, 1);
  }
  return date;
}

/** "Friday, November 6" for a "YYYY-MM-DD". */
export function formatLongDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Invalid date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  if (
    asUtc.getUTCFullYear() !== year ||
    asUtc.getUTCMonth() !== month - 1 ||
    asUtc.getUTCDate() !== day
  ) {
    throw new Error("Invalid date");
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(asUtc);
}
