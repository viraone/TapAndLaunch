/**
 * Wording for a Scheduling app's admin home. Every string that appears there is built here, so the page itself only
 * lays out what these functions return and the cases can be read (and tested) without a browser.
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function parseLocalDate(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Invalid date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid date");
  }
  return parsed;
}

/** "45 min", "1 h", "1.5 h", "2 h" — minutes under an hour stay minutes. */
export function visitLengthLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Number((minutes / 60).toFixed(2))} h`;
}

/** "Wednesday, Nov 4 · 3 visits today", "… · 1 visit today", "… · No visits today". `date` is YYYY-MM-DD local. */
export function todayHeaderLine(date: string, visitsToday: number): string {
  const parsed = parseLocalDate(date);
  const visits =
    visitsToday === 0 ? "No visits today" : `${visitsToday} ${visitsToday === 1 ? "visit" : "visits"} today`;
  return `${WEEKDAYS[parsed.getUTCDay()]}, ${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCDate()} · ${visits}`;
}

/** The sentence before "See the full schedule" in the Today card's footer. */
export function moreThisWeekLine(n: number): string {
  return n === 0 ? "Nothing else this week" : `${n} more ${n === 1 ? "visit" : "visits"} this week`;
}

/** The Schedule tile's status line: "6 this week", or "Nothing this week". */
export function scheduleTileStatus(n: number): string {
  return n === 0 ? "Nothing this week" : `${n} this week`;
}

/** The Customers tile's status line: "24 people", "1 person", or "No customers yet". */
export function customersTileStatus(n: number): string {
  if (n === 0) return "No customers yet";
  return `${n} ${n === 1 ? "person" : "people"}`;
}

export interface ReminderTileFacts {
  connected: boolean;
  needsReconnect: boolean;
  enabled: boolean;
  hoursBefore: number | null;
}

function reminderLeadLabel(hoursBefore: number): string {
  if (hoursBefore >= 24 && hoursBefore % 24 === 0) {
    const days = hoursBefore / 24;
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  return `${hoursBefore} ${hoursBefore === 1 ? "hour" : "hours"}`;
}

/**
 * The Reminders tile's status line. A connection that Google no longer accepts is asked for again before anything
 * else; an automatic reminder is only "On" when one is actually saved.
 */
export function remindersTileStatus(facts: ReminderTileFacts): string {
  if (!facts.connected) return "Connect Gmail to email customers";
  if (facts.needsReconnect) return "Reconnect Gmail to keep emailing";
  if (!facts.enabled || !facts.hoursBefore || facts.hoursBefore <= 0) return "Off · customers are not emailed";
  return `Emails customers ${reminderLeadLabel(facts.hoursBefore)} before`;
}

/** The Automation tile's status line: "2 messages on", "1 message on", or "Nothing scheduled". */
export function automationTileStatus(n: number): string {
  if (n === 0) return "Nothing scheduled";
  return `${n} ${n === 1 ? "message" : "messages"} on`;
}

export type SetupStepKey = "customer" | "visit" | "gmail";

export interface SetupStep {
  key: SetupStepKey;
  label: string;
  /** The dashboard section, after `/dashboard/apps/<appId>/`. */
  path: string;
  done: boolean;
}

export interface SetupProgress {
  steps: SetupStep[];
  /** The first step still to do, or null when all three are done. */
  nextIndex: number | null;
  doneCount: number;
}

/** The "Get set up" strip: three steps, in the order a new business would take them. */
export function setupSteps(input: { customers: number; anyVisit: boolean; gmailReady: boolean }): SetupProgress {
  const steps: SetupStep[] = [
    { key: "customer", label: "Add a customer", path: "customers", done: input.customers > 0 },
    { key: "visit", label: "Add a visit", path: "schedule", done: input.anyVisit },
    { key: "gmail", label: "Connect Gmail", path: "reminders", done: input.gmailReady },
  ];
  const nextIndex = steps.findIndex((step) => !step.done);
  return {
    steps,
    nextIndex: nextIndex === -1 ? null : nextIndex,
    doneCount: steps.filter((step) => step.done).length,
  };
}
