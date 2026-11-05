import { findUnknownTokensIn } from "@/lib/reminders/render";

/** Placeholders the owner can put in an automation, written as {first_name} in text. */
export const AUTOMATION_TOKENS = [
  "first_name",
  "name",
  "show_name",
  "show_date",
  "show_time",
  "venue",
] as const;

/** The reminder a new automation starts with: Thursday night, before the usual Friday show. */
export const DEFAULT_AUTOMATION: {
  name: string;
  schedule_kind: "weekly";
  weekday: 4;
  send_time: "19:00";
  subject: string;
  body: string;
} = {
  name: "Thursday reminder",
  schedule_kind: "weekly",
  weekday: 4,
  send_time: "19:00",
  subject: "Reminder: you're performing tomorrow night",
  body: "Hey {first_name},\n\nThis is a friendly reminder that you're scheduled to perform tomorrow night ({show_date}) at {show_name}.\n\nReply to this email if anything changes.\n\nThanks!",
};

export interface AutomationInput {
  id: string | null;
  name: string;
  schedule_kind: "weekly" | "once";
  weekday: number | null;
  once_date: string | null;
  send_time: string;
  subject: string;
  body: string;
  recipients: { name: string | null; email: string }[];
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEND_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Simple enough to reject spaces, commas and line breaks before anything reaches Gmail. */
const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const MAX_RECIPIENTS = 500;
const TOKEN_HELP = AUTOMATION_TOKENS.map((token) => `{${token}}`).join(", ");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A real calendar date written exactly as "YYYY-MM-DD". */
function isDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim();
  return (
    email.length > 0 &&
    email.length <= 254 &&
    !/[\r\n]/.test(email) &&
    EMAIL_PATTERN.test(email)
  );
}

function parseRecipients(
  value: unknown
): ParseResult<{ name: string | null; email: string }[]> {
  if (!Array.isArray(value)) {
    return { ok: false, error: "Could not read the recipients." };
  }
  if (value.length > MAX_RECIPIENTS) {
    return { ok: false, error: `Too many recipients (${MAX_RECIPIENTS} at most).` };
  }

  const recipients: { name: string | null; email: string }[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!isRecord(entry) || !isEmail(entry.email)) {
      return { ok: false, error: "One of the recipients has an invalid email address." };
    }

    let name: string | null = null;
    if (entry.name !== undefined && entry.name !== null) {
      if (typeof entry.name !== "string") {
        return { ok: false, error: "A recipient's name isn't valid." };
      }
      const trimmed = entry.name.trim();
      if (trimmed.length > 120) {
        return {
          ok: false,
          error: "A recipient's name is too long (120 characters at most).",
        };
      }
      name = trimmed.length > 0 ? trimmed : null;
    }

    const email = entry.email.trim().toLowerCase();
    // The first row for an address wins, exactly as the owner picked it.
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push({ name, email });
  }

  return { ok: true, value: recipients };
}

/** Checks the Automation screen's fields and returns the trimmed values the row should hold. */
export function parseAutomationInput(body: unknown): ParseResult<AutomationInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Could not read the automation." };
  }

  let id: string | null = null;
  if (body.id !== undefined && body.id !== null) {
    if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id)) {
      return { ok: false, error: "The automation isn't valid." };
    }
    id = body.id;
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return { ok: false, error: "Write a name." };
  }
  const name = body.name.trim();
  if (name.length > 80) {
    return { ok: false, error: "The name is too long (80 characters at most)." };
  }

  if (body.schedule_kind !== "weekly" && body.schedule_kind !== "once") {
    return { ok: false, error: "Choose how often to send this reminder." };
  }
  const scheduleKind = body.schedule_kind;

  let weekday: number | null = null;
  let onceDate: string | null = null;
  if (scheduleKind === "weekly") {
    if (
      typeof body.weekday !== "number" ||
      !Number.isInteger(body.weekday) ||
      body.weekday < 0 ||
      body.weekday > 6
    ) {
      return { ok: false, error: "Choose the day of the week." };
    }
    weekday = body.weekday;
  } else {
    if (!isDateString(body.once_date)) {
      return { ok: false, error: "Choose the date." };
    }
    onceDate = body.once_date;
  }

  if (typeof body.send_time !== "string" || !SEND_TIME_PATTERN.test(body.send_time)) {
    return { ok: false, error: "Choose the time of day." };
  }
  const sendTime = body.send_time;

  if (typeof body.subject !== "string" || body.subject.trim().length === 0) {
    return { ok: false, error: "Write a subject." };
  }
  const subject = body.subject.trim();
  if (subject.length > 150) {
    return { ok: false, error: "The subject is too long (150 characters at most)." };
  }
  if (/[\r\n]/.test(subject)) {
    return { ok: false, error: "The subject can't contain line breaks." };
  }

  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    return { ok: false, error: "Write a message." };
  }
  const message = body.body.trim();
  if (message.length > 3000) {
    return { ok: false, error: "The message is too long (3000 characters at most)." };
  }

  const recipients = parseRecipients(body.recipients);
  if (!recipients.ok) return recipients;

  for (const text of [subject, message]) {
    const [unknown] = findUnknownTokensIn(text, AUTOMATION_TOKENS);
    if (unknown) {
      return {
        ok: false,
        error: `Unknown placeholder {${unknown}}. You can use: ${TOKEN_HELP}.`,
      };
    }
  }

  return {
    ok: true,
    value: {
      id,
      name,
      schedule_kind: scheduleKind,
      weekday,
      once_date: onceDate,
      send_time: sendTime,
      subject,
      body: message,
      recipients: recipients.value,
    },
  };
}
