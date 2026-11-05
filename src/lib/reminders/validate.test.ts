import { describe, expect, it } from "vitest";
import {
  REMINDER_HOURS_BEFORE,
  parseReminderSettings,
  type ReminderSettingsInput,
} from "./validate";

const TOKEN_HELP =
  "{first_name}, {name}, {date}, {time}, {address}, {service}, {business}";

function input(overrides: Partial<Record<keyof ReminderSettingsInput, unknown>> = {}) {
  return {
    hours_before: 24,
    subject: "Reminder: {business} on {date}",
    body: "Hi {first_name}, see you at {time}.",
    prep_note: null,
    ...overrides,
  };
}

describe("parseReminderSettings", () => {
  it("accepts a complete reminder and trims its text", () => {
    const parsed = parseReminderSettings({
      hours_before: 48,
      subject: "  Reminder: {business}  ",
      body: "  Hi {first_name}.  ",
      prep_note: "  Gate code 1234.  ",
    });

    expect(parsed).toEqual({
      ok: true,
      value: {
        hours_before: 48,
        subject: "Reminder: {business}",
        body: "Hi {first_name}.",
        prep_note: "Gate code 1234.",
      },
    });
  });

  it("rejects a body that is not an object", () => {
    for (const body of [null, "text", 42, []]) {
      expect(parseReminderSettings(body)).toEqual({
        ok: false,
        error: "Could not read the reminder settings.",
      });
    }
  });

  it.each([1, 2, 4, 12, 24, 48, 72])("accepts %i hours before", (hours) => {
    expect(parseReminderSettings(input({ hours_before: hours })).ok).toBe(true);
  });

  it("only allows the listed hour choices", () => {
    expect(REMINDER_HOURS_BEFORE).toEqual([1, 2, 4, 12, 24, 48, 72]);

    for (const hours of [0, 3, 23, 73, "24", 24.5, null, undefined]) {
      expect(parseReminderSettings(input({ hours_before: hours }))).toEqual({
        ok: false,
        error: "Choose when to send the reminder.",
      });
    }
  });

  it("requires a subject", () => {
    for (const subject of ["", "   ", null, undefined, 42]) {
      expect(parseReminderSettings(input({ subject }))).toEqual({
        ok: false,
        error: "Write a subject.",
      });
    }
  });

  it("allows a subject of exactly 150 characters and rejects 151", () => {
    expect(
      parseReminderSettings(input({ subject: "a".repeat(150) })).ok
    ).toBe(true);

    const tooLong = parseReminderSettings(input({ subject: "a".repeat(151) }));
    expect(tooLong).toEqual({
      ok: false,
      error: "The subject is too long (150 characters at most).",
    });
  });

  it("measures the subject after trimming", () => {
    expect(
      parseReminderSettings(input({ subject: `  ${"a".repeat(150)}  ` })).ok
    ).toBe(true);
  });

  it("requires a message", () => {
    for (const body of ["", "   ", null, undefined, 42]) {
      expect(parseReminderSettings(input({ body }))).toEqual({
        ok: false,
        error: "Write a message.",
      });
    }
  });

  it("allows a message of exactly 3000 characters and rejects 3001", () => {
    expect(parseReminderSettings(input({ body: "a".repeat(3000) })).ok).toBe(true);

    const tooLong = parseReminderSettings(input({ body: "a".repeat(3001) }));
    expect(tooLong).toEqual({
      ok: false,
      error: "The message is too long (3000 characters at most).",
    });
  });

  it("turns a blank prep note into null", () => {
    for (const prep_note of [null, undefined, "", "   "]) {
      const parsed = parseReminderSettings(input({ prep_note }));
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.value.prep_note).toBeNull();
    }
  });

  it("allows a prep note of exactly 1000 characters and rejects 1001", () => {
    expect(
      parseReminderSettings(input({ prep_note: "a".repeat(1000) })).ok
    ).toBe(true);

    const tooLong = parseReminderSettings(input({ prep_note: "a".repeat(1001) }));
    expect(tooLong).toEqual({
      ok: false,
      error: "The prep note is too long (1000 characters at most).",
    });
  });

  it("rejects a prep note that is not text", () => {
    expect(parseReminderSettings(input({ prep_note: 42 }))).toEqual({
      ok: false,
      error: "The prep note isn't valid.",
    });
  });

  it.each([
    ["subject", { subject: "Hi {nickname}" }],
    ["message", { body: "Hi {nickname}." }],
    ["prep note", { prep_note: "Ask for {nickname}." }],
  ])("rejects an unknown placeholder in the %s", (_label, overrides) => {
    expect(parseReminderSettings(input(overrides))).toEqual({
      ok: false,
      error: `Unknown placeholder {nickname}. You can use: ${TOKEN_HELP}.`,
    });
  });

  it("reports the first unknown placeholder", () => {
    expect(
      parseReminderSettings(input({ subject: "{colour}", body: "{size}" }))
    ).toEqual({
      ok: false,
      error: `Unknown placeholder {colour}. You can use: ${TOKEN_HELP}.`,
    });
  });

  it("accepts every known placeholder in every field", () => {
    const known =
      "{first_name} {name} {date} {time} {address} {service} {business}";

    expect(
      parseReminderSettings(
        input({ subject: known, body: known, prep_note: known })
      ).ok
    ).toBe(true);
  });
});
