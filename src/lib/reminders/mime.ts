import { randomBytes } from "node:crypto";

export interface RawMessageInput {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** "Wed, 04 Nov 2026 12:00:00 +0000" */
function rfc5322Date(date: Date): string {
  return (
    `${DAY_NAMES[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`
  );
}

/** A display name may not carry a line break, a quote or an angle bracket into a header. */
function cleanDisplayName(name: string): string {
  return name.replace(/[\r\n"<>]/g, "").trim();
}

function hasNonAscii(value: string): boolean {
  return /[^\x20-\x7e]/.test(value);
}

/**
 * RFC 2047 "B" encoding for UTF-8. Long text is split into words of at most 45 bytes,
 * never in the middle of a character, so each encoded word stays under the 75-character limit.
 */
function encodedWords(value: string): string {
  const bytes = Buffer.from(value, "utf8");
  const words: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    let end = Math.min(start + 45, bytes.length);
    // 10xxxxxx is a UTF-8 continuation byte: back up to the start of the character.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    if (end === start) end = Math.min(start + 45, bytes.length);

    words.push(`=?UTF-8?B?${bytes.subarray(start, end).toString("base64")}?=`);
    start = end;
  }

  return words.join(" ");
}

function headerText(value: string): string {
  return hasNonAscii(value) ? encodedWords(value) : value;
}

function fromHeader(fromName: string, fromEmail: string): string {
  const name = cleanDisplayName(fromName);
  if (!name) return `<${fromEmail}>`;
  if (hasNonAscii(name)) return `${encodedWords(name)} <${fromEmail}>`;
  return `"${name}" <${fromEmail}>`;
}

/** Base64 in lines of 76 characters, separated by CRLF, as MIME requires. */
function base64Lines(value: string): string {
  const encoded = Buffer.from(value, "utf8").toString("base64");
  const lines: string[] = [];
  for (let index = 0; index < encoded.length; index += 76) {
    lines.push(encoded.slice(index, index + 76));
  }
  return lines.join("\r\n");
}

/**
 * The base64url form of a complete RFC 5322 multipart/alternative message, ready for Gmail's `raw` field.
 *
 * Addresses and the subject are checked for line breaks first: a CR or LF there would inject headers such as Bcc.
 */
export function buildRawMessage(input: RawMessageInput): string {
  if (
    /[\r\n]/.test(input.to) ||
    /[\r\n]/.test(input.fromEmail) ||
    /[\r\n]/.test(input.subject)
  ) {
    throw new Error("Invalid header");
  }

  const boundary = `tapandlaunch_${randomBytes(16).toString("hex")}`;
  const messageId = `<${randomBytes(16).toString("hex")}@tapandlaunch.com>`;

  const message = [
    `From: ${fromHeader(input.fromName, input.fromEmail)}`,
    `To: ${input.to}`,
    `Subject: ${headerText(input.subject)}`,
    "MIME-Version: 1.0",
    `Date: ${rfc5322Date(new Date())}`,
    `Message-ID: ${messageId}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(input.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(input.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return Buffer.from(message, "utf8").toString("base64url");
}
