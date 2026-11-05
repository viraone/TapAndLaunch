import { describe, expect, it } from "vitest";
import {
  AUTOMATION_TOKENS,
  DEFAULT_AUTOMATION,
  parseAutomationInput,
  type AutomationInput,
} from "./validate";

const TOKEN_HELP =
  "{first_name}, {name}, {show_name}, {show_date}, {show_time}, {venue}";
const UUID = "3f2f1a2b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";

function input(
  overrides: Partial<Record<keyof AutomationInput, unknown>> = {}
): Record<string, unknown> {
  return {
    id: null,
    name: "Thursday reminder",
    schedule_kind: "weekly",
    weekday: 4,
    once_date: null,
    send_time: "19:00",
    subject: "Reminder: {show_name} tomorrow",
    body: "Hey {first_name}, see you at {venue}.",
    recipients: [{ name: "Alex Morgan", email: "alex@example.com" }],
    ...overrides,
  };
}

describe("AUTOMATION_TOKENS", () => {
  it("lists the six placeholders the owner can use", () => {
    expect(AUTOMATION_TOKENS).toEqual([
      "first_name",
      "name",
      "show_name",
      "show_date",
      "show_time",
      "venue",
    ]);
  });
});

describe("DEFAULT_AUTOMATION", () => {
  it("starts with the Thursday reminder the owner expects", () => {
    expect(DEFAULT_AUTOMATION).toEqual({
      name: "Thursday reminder",
      schedule_kind: "weekly",
      weekday: 4,
      send_time: "19:00",
      subject: "Reminder: you're performing tomorrow night",
      body: "Hey {first_name},\n\nThis is a friendly reminder that you're scheduled to perform tomorrow night ({show_date}) at {show_name}.\n\nReply to this email if anything changes.\n\nThanks!",
    });
  });

  it("is accepted by the parser as-is", () => {
    expect(
      parseAutomationInput({
        ...DEFAULT_AUTOMATION,
        id: null,
        once_date: null,
        recipients: [],
      }).ok
    ).toBe(true);
  });
});

describe("parseAutomationInput", () => {
  it("accepts a complete reminder and trims its text", () => {
    const parsed = parseAutomationInput(
      input({
        name: "  Thursday reminder  ",
        subject: "  Reminder: {show_name} tomorrow  ",
        body: "  Hey {first_name}, see you at {venue}.  ",
        recipients: [{ name: "  Alex Morgan  ", email: "  ALEX@Example.COM  " }],
      })
    );

    expect(parsed).toEqual({
      ok: true,
      value: {
        id: null,
        name: "Thursday reminder",
        schedule_kind: "weekly",
        weekday: 4,
        once_date: null,
        send_time: "19:00",
        subject: "Reminder: {show_name} tomorrow",
        body: "Hey {first_name}, see you at {venue}.",
        recipients: [{ name: "Alex Morgan", email: "alex@example.com" }],
      },
    });
  });

  it("rejects a body that is not an object", () => {
    for (const body of [null, "text", 42, []]) {
      expect(parseAutomationInput(body)).toEqual({
        ok: false,
        error: "Could not read the automation.",
      });
    }
  });

  it("accepts an absent or null id and a uuid", () => {
    const withoutId = input();
    delete withoutId.id;
    for (const body of [withoutId, input({ id: null }), input({ id: UUID })]) {
      const parsed = parseAutomationInput(body);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.value.id).toBe(body.id ?? null);
    }
  });

  it("rejects an id that is not a uuid", () => {
    for (const id of ["", "not-a-uuid", 42, true]) {
      expect(parseAutomationInput(input({ id }))).toEqual({
        ok: false,
        error: "The automation isn't valid.",
      });
    }
  });

  it("requires a name", () => {
    for (const name of ["", "   ", null, undefined, 42]) {
      expect(parseAutomationInput(input({ name }))).toEqual({
        ok: false,
        error: "Write a name.",
      });
    }
  });

  it("allows a name of exactly 80 characters and rejects 81", () => {
    expect(parseAutomationInput(input({ name: "a".repeat(80) })).ok).toBe(true);
    expect(parseAutomationInput(input({ name: "a".repeat(81) }))).toEqual({
      ok: false,
      error: "The name is too long (80 characters at most).",
    });
  });

  it("measures the name after trimming", () => {
    expect(parseAutomationInput(input({ name: `  ${"a".repeat(80)}  ` })).ok).toBe(true);
  });

  it("requires a schedule kind", () => {
    for (const schedule_kind of ["monthly", null, undefined, 1]) {
      expect(parseAutomationInput(input({ schedule_kind }))).toEqual({
        ok: false,
        error: "Choose how often to send this reminder.",
      });
    }
  });

  it.each([0, 1, 2, 3, 4, 5, 6])("accepts weekday %i", (weekday) => {
    const parsed = parseAutomationInput(input({ weekday }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.weekday).toBe(weekday);
  });

  it("only allows an integer weekday from 0 to 6", () => {
    for (const weekday of [-1, 7, 4.5, "4", null, undefined]) {
      expect(parseAutomationInput(input({ weekday }))).toEqual({
        ok: false,
        error: "Choose the day of the week.",
      });
    }
  });

  it("ignores once_date for a weekly reminder", () => {
    const parsed = parseAutomationInput(input({ once_date: "2026-12-24" }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.once_date).toBeNull();
  });

  it("accepts a real date for a one-off reminder and clears the weekday", () => {
    const parsed = parseAutomationInput(
      input({
        schedule_kind: "once",
        weekday: 4,
        once_date: "2026-12-24",
      })
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.once_date).toBe("2026-12-24");
      expect(parsed.value.weekday).toBeNull();
    }
  });

  it("rejects a one-off date that is not a real YYYY-MM-DD", () => {
    for (const once_date of ["2026-02-30", "11/06/2026", "2026-1-01", "", null, undefined]) {
      expect(
        parseAutomationInput(input({ schedule_kind: "once", once_date }))
      ).toEqual({ ok: false, error: "Choose the date." });
    }
  });

  it.each(["00:00", "09:05", "19:00", "23:59"])("accepts the time %s", (send_time) => {
    expect(parseAutomationInput(input({ send_time })).ok).toBe(true);
  });

  it("only allows a 24-hour HH:MM time", () => {
    for (const send_time of ["24:00", "7:00", "19:60", "19:00:00", "", null, 1900]) {
      expect(parseAutomationInput(input({ send_time }))).toEqual({
        ok: false,
        error: "Choose the time of day.",
      });
    }
  });

  it("requires a subject", () => {
    for (const subject of ["", "   ", null, undefined, 42]) {
      expect(parseAutomationInput(input({ subject }))).toEqual({
        ok: false,
        error: "Write a subject.",
      });
    }
  });

  it("allows a subject of exactly 150 characters and rejects 151", () => {
    expect(parseAutomationInput(input({ subject: "a".repeat(150) })).ok).toBe(true);
    expect(parseAutomationInput(input({ subject: "a".repeat(151) }))).toEqual({
      ok: false,
      error: "The subject is too long (150 characters at most).",
    });
  });

  it("rejects a subject with a line break", () => {
    for (const subject of ["Reminder\nBcc: evil@example.com", "Reminder\rBcc: evil@example.com"]) {
      expect(parseAutomationInput(input({ subject }))).toEqual({
        ok: false,
        error: "The subject can't contain line breaks.",
      });
    }
  });

  it("requires a message", () => {
    for (const body of ["", "   ", null, undefined, 42]) {
      expect(parseAutomationInput(input({ body }))).toEqual({
        ok: false,
        error: "Write a message.",
      });
    }
  });

  it("allows a message of exactly 3000 characters and rejects 3001", () => {
    expect(parseAutomationInput(input({ body: "a".repeat(3000) })).ok).toBe(true);
    expect(parseAutomationInput(input({ body: "a".repeat(3001) }))).toEqual({
      ok: false,
      error: "The message is too long (3000 characters at most).",
    });
  });

  it("allows a saved draft with no recipients", () => {
    const parsed = parseAutomationInput(input({ recipients: [] }));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.recipients).toEqual([]);
  });

  it("rejects recipients that are not an array", () => {
    for (const recipients of [undefined, null, "alex@example.com", {}]) {
      expect(parseAutomationInput(input({ recipients }))).toEqual({
        ok: false,
        error: "Could not read the recipients.",
      });
    }
  });

  it("allows exactly 500 recipients and rejects 501", () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        name: null,
        email: `person${index}@example.com`,
      }));

    expect(parseAutomationInput(input({ recipients: many(500) })).ok).toBe(true);
    expect(parseAutomationInput(input({ recipients: many(501) }))).toEqual({
      ok: false,
      error: "Too many recipients (500 at most).",
    });
  });

  it.each([
    "alex",
    "alex@",
    "@example.com",
    "a b@example.com",
    "a,b@example.com",
    "a@b",
    "a@b.",
    "a\n@example.com",
    "a\r@example.com",
    "",
  ])("rejects the email address %j", (email) => {
    expect(parseAutomationInput(input({ recipients: [{ name: null, email }] }))).toEqual({
      ok: false,
      error: "One of the recipients has an invalid email address.",
    });
  });

  it("rejects a recipient that is not an object", () => {
    expect(parseAutomationInput(input({ recipients: ["alex@example.com"] }))).toEqual({
      ok: false,
      error: "One of the recipients has an invalid email address.",
    });
  });

  it("rejects a recipient name that is not text", () => {
    expect(
      parseAutomationInput(input({ recipients: [{ name: 42, email: "alex@example.com" }] }))
    ).toEqual({ ok: false, error: "A recipient's name isn't valid." });
  });

  it("allows a recipient name of exactly 120 characters and rejects 121", () => {
    expect(
      parseAutomationInput(
        input({ recipients: [{ name: "a".repeat(120), email: "alex@example.com" }] })
      ).ok
    ).toBe(true);
    expect(
      parseAutomationInput(
        input({ recipients: [{ name: "a".repeat(121), email: "alex@example.com" }] })
      )
    ).toEqual({
      ok: false,
      error: "A recipient's name is too long (120 characters at most).",
    });
  });

  it("turns a blank recipient name into null", () => {
    for (const name of [null, undefined, "", "   "]) {
      const parsed = parseAutomationInput(
        input({ recipients: [{ name, email: "alex@example.com" }] })
      );
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.value.recipients[0].name).toBeNull();
    }
  });

  it("de-duplicates by email, keeping the first name", () => {
    const parsed = parseAutomationInput(
      input({
        recipients: [
          { name: "First", email: "alex@example.com" },
          { name: "Second", email: "  ALEX@EXAMPLE.COM  " },
          { name: "Other", email: "sam@example.com" },
        ],
      })
    );

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.recipients).toEqual([
        { name: "First", email: "alex@example.com" },
        { name: "Other", email: "sam@example.com" },
      ]);
    }
  });

  it.each([
    ["subject", { subject: "Hi {nickname}" }],
    ["message", { body: "Hi {nickname}." }],
  ])("rejects an unknown placeholder in the %s", (_label, overrides) => {
    expect(parseAutomationInput(input(overrides))).toEqual({
      ok: false,
      error: `Unknown placeholder {nickname}. You can use: ${TOKEN_HELP}.`,
    });
  });

  it("reports the first unknown placeholder", () => {
    expect(
      parseAutomationInput(input({ subject: "{colour}", body: "{size}" }))
    ).toEqual({
      ok: false,
      error: `Unknown placeholder {colour}. You can use: ${TOKEN_HELP}.`,
    });
  });

  it("accepts every known placeholder in both fields", () => {
    const known =
      "{first_name} {name} {show_name} {show_date} {show_time} {venue}";

    expect(parseAutomationInput(input({ subject: known, body: known })).ok).toBe(true);
  });
});
