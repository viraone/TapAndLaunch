import { describe, expect, it } from "vitest";
import { buildRawMessage } from "./mime";

const INPUT = {
  fromName: "Sparkle Cleaning",
  fromEmail: "owner@example.com",
  to: "customer@example.com",
  subject: "Reminder: see you soon",
  text: "Hi Alex,\n\nSee you on Tuesday.",
  html: '<div><p>Hi Alex,</p><p>See you on Tuesday.</p></div>',
};

function decode(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

function header(message: string, name: string): string {
  const match = new RegExp(`^${name}: (.*)$`, "m").exec(message);
  return match?.[1] ?? "";
}

function boundaryOf(message: string): string {
  return /boundary="([^"]+)"/.exec(message)?.[1] ?? "";
}

function partsOf(message: string): string[] {
  return message.split(`--${boundaryOf(message)}`).slice(1, -1);
}

function bodyOf(part: string): string {
  const separator = part.indexOf("\r\n\r\n");
  const encoded = part.slice(separator + 4).replace(/\r\n/g, "").trim();
  return Buffer.from(encoded, "base64").toString("utf8");
}

function decodeEncodedWords(value: string): string {
  const words = value.match(/=\?UTF-8\?B\?[^?]*\?=/g) ?? [];
  return words
    .map((word) =>
      Buffer.from(word.slice("=?UTF-8?B?".length, -2), "base64").toString("utf8")
    )
    .join("");
}

describe("buildRawMessage", () => {
  it("writes the headers an email needs", () => {
    const message = decode(buildRawMessage(INPUT));

    expect(header(message, "From")).toBe('"Sparkle Cleaning" <owner@example.com>');
    expect(header(message, "To")).toBe("customer@example.com");
    expect(header(message, "Subject")).toBe("Reminder: see you soon");
    expect(header(message, "MIME-Version")).toBe("1.0");
    expect(header(message, "Date")).toMatch(
      /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} \+0000$/
    );
    expect(header(message, "Message-ID")).toMatch(
      /^<[0-9a-f]{32}@tapandlaunch\.com>$/
    );
    expect(header(message, "Content-Type")).toMatch(
      /^multipart\/alternative; boundary="tapandlaunch_[0-9a-f]{32}"$/
    );
  });

  it("puts the text part first and the HTML part second, both base64", () => {
    const message = decode(buildRawMessage(INPUT));
    const parts = partsOf(message);

    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(parts[1]).toContain("Content-Type: text/html; charset=UTF-8");
    for (const part of parts) {
      expect(part).toContain("Content-Transfer-Encoding: base64");
      for (const line of part.split("\r\n")) {
        expect(line.length).toBeLessThanOrEqual(76);
      }
    }
    expect(bodyOf(parts[0])).toBe(INPUT.text);
    expect(bodyOf(parts[1])).toBe(INPUT.html);
  });

  it("keeps non-ASCII text intact through base64", () => {
    const text = "Café ☕ — see you there";
    const html = "<p>Café ☕ — see you there</p>";
    const message = decode(buildRawMessage({ ...INPUT, text, html }));
    const parts = partsOf(message);

    expect(bodyOf(parts[0])).toBe(text);
    expect(bodyOf(parts[1])).toBe(html);
  });

  it("encodes a subject with an accent and an emoji as RFC 2047 words", () => {
    const subject = "Café reminder 🎉";
    const message = decode(buildRawMessage({ ...INPUT, subject }));
    const encodedSubject = header(message, "Subject");

    expect(encodedSubject).toMatch(/^=\?UTF-8\?B\?/);
    expect(encodedSubject).not.toContain("Café");
    expect(decodeEncodedWords(encodedSubject)).toBe(subject);
  });

  it("leaves an ASCII subject as readable text", () => {
    const message = decode(buildRawMessage(INPUT));

    expect(header(message, "Subject")).not.toContain("=?UTF-8?B?");
  });

  it("encodes a non-ASCII display name and keeps the address", () => {
    const message = decode(
      buildRawMessage({ ...INPUT, fromName: "Café Cleaning" })
    );
    const from = header(message, "From");

    expect(from).toMatch(/^=\?UTF-8\?B\?/);
    expect(from.endsWith(" <owner@example.com>")).toBe(true);
    expect(decodeEncodedWords(from)).toBe("Café Cleaning");
  });

  it("strips quotes, angle brackets and line breaks from the display name", () => {
    const message = decode(
      buildRawMessage({
        ...INPUT,
        fromName: 'Bad "Name" <boss@example.com>\r\nBcc: evil@example.com',
      })
    );
    const from = header(message, "From");

    expect(from).toBe('"Bad Name boss@example.comBcc: evil@example.com" <owner@example.com>');
    expect(message).not.toContain("\r\nBcc:");
  });

  it("uses a fresh boundary and Message-ID for every message", () => {
    const first = decode(buildRawMessage(INPUT));
    const second = decode(buildRawMessage(INPUT));

    expect(boundaryOf(first)).not.toBe(boundaryOf(second));
    expect(header(first, "Message-ID")).not.toBe(header(second, "Message-ID"));
  });

  it.each([
    ["to", { to: "customer@example.com\r\nBcc: evil@example.com" }],
    ["fromEmail", { fromEmail: "owner@example.com\nBcc: evil@example.com" }],
    ["subject", { subject: "Hello\r\nBcc: evil@example.com" }],
  ])("refuses a line break in %s", (_field, override) => {
    expect(() => buildRawMessage({ ...INPUT, ...override })).toThrow(
      "Invalid header"
    );
  });

  it("returns base64url that decodes to the whole message", () => {
    const raw = buildRawMessage(INPUT);

    expect(raw).not.toMatch(/[+/=]/);
    expect(decode(raw).endsWith("--\r\n")).toBe(true);
  });
});
