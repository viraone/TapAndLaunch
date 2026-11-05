import { formatLongDate } from "./schedule";

/**
 * The pure bits of the Automation screen (block view "automation"). Everything here runs in the browser and has no
 * server-only imports: the screen uses these to write a schedule, a date and a contact list the owner can read.
 */

export interface AutomationRecipient {
  name: string | null;
  email: string;
}

export interface AutomationRecentSend {
  occurrence_at: string;
  sent: number;
  failed: number;
  sending: number;
}

/** One saved reminder, exactly as GET /openmic/automation returns it (lib/automation/state.ts ReminderState). */
export interface AutomationReminder {
  id: string;
  name: string;
  enabled: boolean;
  schedule_kind: "weekly" | "once";
  weekday: number | null;
  once_date: string | null;
  send_time: string;
  time_zone: string;
  subject: string;
  body: string;
  nextSendAt: string | null;
  recipients: AutomationRecipient[];
  recent: AutomationRecentSend[];
}

export interface AutomationGmail {
  configured: boolean;
  connected: boolean;
  email: string | null;
  canSend: boolean;
  canReadContacts: boolean;
  needsReconnect: boolean;
}

export interface AutomationDefaults {
  name: string;
  schedule_kind: "weekly";
  weekday: number;
  send_time: string;
  subject: string;
  body: string;
}

/** Everything GET /openmic/automation answers with. */
export interface AutomationState {
  gmail: AutomationGmail;
  showName: string;
  timeZone: string;
  reminders: AutomationReminder[];
  defaults: AutomationDefaults;
}

export interface AutomationContact {
  name: string;
  email: string;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Intl uses a narrow no-break space before AM/PM in newer ICU versions; keep the text identical everywhere. */
function cleanSpaces(value: string): string {
  let cleaned = "";
  for (const char of value) {
    const code = char.codePointAt(0);
    cleaned += code === 0x00a0 || code === 0x202f ? " " : char;
  }
  return cleaned;
}

/** "19:00" (or Postgres's "19:00:00") → "7:00 PM". An unreadable time is handed back as it came. */
export function formatTimeOfDay(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hhmm.trim());
  if (!match) return hhmm;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return hhmm;
  const suffix = hours < 12 ? "AM" : "PM";
  const shown = hours % 12 === 0 ? 12 : hours % 12;
  return `${shown}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function isDateString(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** "Every Thursday at 7:00 PM", or "Once on Friday, November 6 at 7:00 PM". */
export function describeSchedule(r: {
  schedule_kind: "weekly" | "once";
  weekday: number | null;
  once_date: string | null;
  send_time: string;
}): string {
  const time = formatTimeOfDay(r.send_time);
  if (r.schedule_kind === "once") {
    if (isDateString(r.once_date)) {
      try {
        return `Once on ${formatLongDate(r.once_date)} at ${time}`;
      } catch {
        // A date the screen cannot read falls through to the plain wording below.
      }
    }
    return `One time at ${time}`;
  }
  if (r.weekday !== null && Number.isInteger(r.weekday) && r.weekday >= 0 && r.weekday <= 6) {
    return `Every ${DAY_NAMES[r.weekday]} at ${time}`;
  }
  return `Every week at ${time}`;
}

/** "Thu, Nov 5, 7:00 PM" for an ISO instant, read in the show's time zone. */
export function formatInstant(iso: string, timeZone: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  try {
    return cleanSpaces(
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone,
      }).format(at)
    );
  } catch {
    return iso;
  }
}

/** The contacts whose name or address contains the query, ignoring case and surrounding spaces. Empty = all. */
export function filterContacts(
  contacts: AutomationContact[],
  query: string
): AutomationContact[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return contacts;
  return contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(wanted) ||
      contact.email.toLowerCase().includes(wanted)
  );
}

/** Adds the addresses not already present, matching by lower-cased email; the first row for an address wins. */
export function mergeRecipients(
  current: AutomationRecipient[],
  additions: AutomationRecipient[]
): AutomationRecipient[] {
  const merged = [...current];
  const seen = new Set(current.map((recipient) => recipient.email.trim().toLowerCase()));
  for (const addition of additions) {
    const email = addition.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    merged.push(addition);
  }
  return merged;
}

const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** The same rule the server's parseAutomationInput uses, so the screen refuses what the route would. */
export function looksLikeEmail(value: string): boolean {
  const email = value.trim();
  return (
    email.length > 0 &&
    email.length <= 254 &&
    !/[\r\n]/.test(email) &&
    EMAIL_PATTERN.test(email)
  );
}

/** "1 person" or "18 people", for the count under a reminder's name. */
export function peopleLabel(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

/** "18 sent", "17 sent, 1 failed", or "sending…" while an occurrence is still going out. */
export function summarizeRecent(r: {
  sent: number;
  failed: number;
  sending: number;
}): string {
  if (r.sending > 0) return "sending…";
  if (r.failed > 0) return `${r.sent} sent, ${r.failed} failed`;
  return `${r.sent} sent`;
}
