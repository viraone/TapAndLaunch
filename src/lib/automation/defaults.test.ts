import { describe, expect, it } from "vitest";
import { automationDefaultsFor } from "./defaults";
import { DEFAULT_AUTOMATION, parseAutomationInput } from "./validate";

const STAGETIME_BODY =
  "The order for tomorrow's lineup:\nhttps://stagetimepnw.tapandlaunch.com\n\nSign in with your email, enter the 6-digit code, and you'll see your time.\n\nThe RickshawHAHA";

describe("automationDefaultsFor", () => {
  it.each([
    ["no config", null],
    ["undefined config", undefined],
    ["no override", {}],
    ["a number", { reminder_default_body: 7 }],
    ["an object", { reminder_default_body: { text: "hi" } }],
    ["an array", { reminder_default_body: ["hi"] }],
    ["null", { reminder_default_body: null }],
    ["an empty string", { reminder_default_body: "" }],
    ["only whitespace", { reminder_default_body: " \n\t " }],
    ["a message over the limit", { reminder_default_body: "a".repeat(3001) }],
  ])("keeps the shared wording for %s", (_label, config) => {
    expect(automationDefaultsFor(config)).toEqual(DEFAULT_AUTOMATION);
  });

  it("uses the app's own message, trimmed, with plain line breaks", () => {
    const result = automationDefaultsFor({ reminder_default_body: "  Line one\r\nLine two  " });
    expect(result).toEqual({ ...DEFAULT_AUTOMATION, body: "Line one\nLine two" });
  });

  it("accepts a message exactly at the limit", () => {
    const body = "a".repeat(3000);
    expect(automationDefaultsFor({ reminder_default_body: body }).body).toBe(body);
  });

  it("returns a copy and leaves the shared default alone", () => {
    const before = DEFAULT_AUTOMATION.body;
    const result = automationDefaultsFor({ reminder_default_body: "Something else" });
    expect(result).not.toBe(DEFAULT_AUTOMATION);
    expect(automationDefaultsFor(null)).not.toBe(DEFAULT_AUTOMATION);
    expect(DEFAULT_AUTOMATION.body).toBe(before);
  });

  it("keeps StageTime's lineup message intact, and it saves as a reminder", () => {
    const defaults = automationDefaultsFor({ reminder_default_body: STAGETIME_BODY });
    expect(defaults.body).toBe(STAGETIME_BODY);
    const parsed = parseAutomationInput({
      ...defaults,
      id: null,
      once_date: null,
      recipients: [],
    });
    expect(parsed.ok).toBe(true);
  });
});
