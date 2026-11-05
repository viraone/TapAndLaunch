/** Placeholders the owner can put in a reminder, written as {first_name} in text. */
export const REMINDER_TOKENS = [
  "first_name",
  "name",
  "date",
  "time",
  "address",
  "service",
  "business",
] as const;

export type ReminderToken = (typeof REMINDER_TOKENS)[number];

/** The email a new app starts with. Deliberately plain: no images and no links. */
export const DEFAULT_REMINDER: {
  hours_before: 24;
  subject: string;
  body: string;
  prep_note: string | null;
} = {
  hours_before: 24,
  subject: "Reminder: {business} on {date} at {time}",
  body: "Hi {first_name},\n\nThis is a friendly reminder that we're scheduled to visit you on {date} at {time}.\n\nIf anything changes, just reply to this email.\n\nThank you,\n{business}",
  prep_note: null,
};

const TOKEN_RE = /\{([^{}]+)\}/g;

function isKnownToken(name: string): name is ReminderToken {
  return (REMINDER_TOKENS as readonly string[]).includes(name);
}

/** The names inside {...} that are not one of REMINDER_TOKENS, de-duplicated in the order they appear. */
export function findUnknownTokens(text: string): string[] {
  const unknown: string[] = [];
  for (const match of text.matchAll(TOKEN_RE)) {
    const name = match[1].trim();
    if (name.length === 0 || isKnownToken(name) || unknown.includes(name)) continue;
    unknown.push(name);
  }
  return unknown;
}

/**
 * Replaces the known {tokens} in one pass. A known token with no value becomes "", an unknown one is left as it was,
 * and replaced text is never scanned again (so a name containing "{name}" stays literal).
 */
export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(TOKEN_RE, (whole, rawName: string) => {
    const name = rawName.trim();
    return isKnownToken(name) ? (values[name] ?? "") : whole;
  });
}

export interface ReminderValues {
  name: string;
  address: string | null;
  service: string | null;
  business: string;
  startsAt: Date;
  timeZone: string;
}

/** Intl uses a narrow no-break space before AM/PM in newer ICU versions; keep the text identical everywhere. */
function cleanSpaces(value: string): string {
  let cleaned = "";
  for (const char of value) {
    const code = char.codePointAt(0);
    cleaned += code === 0x00a0 || code === 0x202f ? " " : char;
  }
  return cleaned;
}

/** The text each token stands for, already written the way the customer will read it. */
export function reminderValues(v: ReminderValues): Record<string, string> {
  const name = v.name.trim().replace(/\s+/g, " ");
  return {
    first_name: name.split(/\s+/)[0] ?? "",
    name,
    date: cleanSpaces(
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: v.timeZone,
      }).format(v.startsAt)
    ),
    time: cleanSpaces(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: v.timeZone,
      }).format(v.startsAt)
    ),
    address: v.address ?? "",
    service: v.service ?? "",
    business: v.business,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PARAGRAPH_STYLE = 'style="margin:0 0 16px"';

/** Blank lines separate paragraphs; a single newline is a line break inside one. */
function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function paragraphHtml(paragraph: string): string {
  return `<p ${PARAGRAPH_STYLE}>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`;
}

export interface ReminderSettings {
  subject: string;
  body: string;
  prep_note: string | null;
}

/**
 * The subject, plain text and HTML for one reminder. The HTML is built here from escaped text, never from raw
 * customer data, and it carries no images, links or tracking.
 */
export function renderReminder(
  settings: ReminderSettings,
  values: Record<string, string>
): { subject: string; text: string; html: string } {
  // A line break in a subject would let its text inject headers; flatten it.
  const subject = renderTemplate(settings.subject, values)
    .replace(/[\r\n\t]+/g, " ")
    .trim();

  const body = renderTemplate(settings.body, values);
  const prepNote = settings.prep_note
    ? renderTemplate(settings.prep_note, values).trim()
    : "";

  const text = prepNote
    ? `${body}\n\nBefore we arrive:\n${prepNote}`
    : body;

  const bodyHtml = paragraphs(body).map(paragraphHtml).join("");
  let prepHtml = "";
  if (prepNote) {
    prepHtml = paragraphs(prepNote)
      .map((paragraph, index) => {
        const label = index === 0 ? "<strong>Before we arrive:</strong><br>" : "";
        return `<p ${PARAGRAPH_STYLE}>${label}${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`;
      })
      .join("");
  }

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#222">${bodyHtml}${prepHtml}</div>`;

  return { subject, text, html };
}
