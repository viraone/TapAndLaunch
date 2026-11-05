import { REMINDER_TOKENS, findUnknownTokens } from "./render";

export type ReminderHoursBefore = 1 | 2 | 4 | 12 | 24 | 48 | 72;

export const REMINDER_HOURS_BEFORE: readonly ReminderHoursBefore[] = [
  1, 2, 4, 12, 24, 48, 72,
];

export interface ReminderSettingsInput {
  hours_before: ReminderHoursBefore;
  subject: string;
  body: string;
  prep_note: string | null;
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const TOKEN_HELP = REMINDER_TOKENS.map((token) => `{${token}}`).join(", ");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHoursBefore(value: unknown): value is ReminderHoursBefore {
  return (
    typeof value === "number" &&
    (REMINDER_HOURS_BEFORE as readonly number[]).includes(value)
  );
}

function unknownTokenError(text: string): string | null {
  const [unknown] = findUnknownTokens(text);
  if (!unknown) return null;
  return `Unknown placeholder {${unknown}}. You can use: ${TOKEN_HELP}.`;
}

/** Checks the reminder editor's fields and returns the trimmed values the row should hold. */
export function parseReminderSettings(body: unknown): ParseResult<ReminderSettingsInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Could not read the reminder settings." };
  }

  if (!isHoursBefore(body.hours_before)) {
    return { ok: false, error: "Choose when to send the reminder." };
  }

  if (typeof body.subject !== "string" || body.subject.trim().length === 0) {
    return { ok: false, error: "Write a subject." };
  }
  const subject = body.subject.trim();
  if (subject.length > 150) {
    return {
      ok: false,
      error: "The subject is too long (150 characters at most).",
    };
  }

  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    return { ok: false, error: "Write a message." };
  }
  const message = body.body.trim();
  if (message.length > 3000) {
    return {
      ok: false,
      error: "The message is too long (3000 characters at most).",
    };
  }

  let prepNote: string | null = null;
  if (body.prep_note !== undefined && body.prep_note !== null) {
    if (typeof body.prep_note !== "string") {
      return { ok: false, error: "The prep note isn't valid." };
    }
    const trimmed = body.prep_note.trim();
    if (trimmed.length > 1000) {
      return {
        ok: false,
        error: "The prep note is too long (1000 characters at most).",
      };
    }
    prepNote = trimmed.length > 0 ? trimmed : null;
  }

  for (const text of [subject, message, prepNote ?? ""]) {
    const error = unknownTokenError(text);
    if (error) return { ok: false, error };
  }

  return {
    ok: true,
    value: {
      hours_before: body.hours_before,
      subject,
      body: message,
      prep_note: prepNote,
    },
  };
}
