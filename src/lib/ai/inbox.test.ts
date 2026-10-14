import { describe, expect, it, vi } from "vitest";
import { InboxExtraction, extractUpdate, toUtc } from "./inbox";

describe("InboxExtraction", () => {
  it("accepts the shape and drops bad links and times", () => {
    const ok = InboxExtraction.safeParse({ summary: "Found a show.", events: [{ title: "Laugh night", starts_at: "2026-10-31T20:00", ticket_url: "https://tickets.example/x" }], announcement: null });
    expect(ok.success).toBe(true);
    expect(InboxExtraction.safeParse({ summary: "x", events: [{ title: "Bad", starts_at: "Friday 8pm" }] }).success).toBe(false);
    expect(InboxExtraction.safeParse({ summary: "x", events: [{ title: "Bad", starts_at: "2026-10-31T20:00", ticket_url: "javascript:alert(1)" }] }).success).toBe(false);
  });
});

describe("toUtc", () => {
  it("reads a local time in the owner's zone and keeps a zoned one", () => {
    expect(toUtc("2026-07-04T19:00", "America/Los_Angeles")).toBe("2026-07-05T02:00:00.000Z");
    expect(toUtc("2026-07-04T19:00:00Z", "America/Los_Angeles")).toBe("2026-07-04T19:00:00.000Z");
  });
});

describe("extractUpdate", () => {
  it("sends today's date, the site and the paste, and returns events in UTC", async () => {
    const ask = vi.fn().mockResolvedValue(JSON.stringify({ summary: "One show.", events: [{ title: "Laugh night", starts_at: "2026-10-31T20:00", location: "The Rickshaw, Seattle" }], announcement: { text: "Halloween show Oct 31" }, questions: [] }));
    const found = await extractUpdate({ site: '{"name":"Dave"}', text: "HALLOWEEN SHOW Oct 31 8pm at The Rickshaw", timeZone: "America/Los_Angeles", now: new Date("2026-10-14T12:00:00Z"), ask });
    expect(found?.events[0]).toMatchObject({ title: "Laugh night", starts_at: "2026-11-01T03:00:00.000Z", location: "The Rickshaw, Seattle" });
    expect(found?.announcement?.text).toBe("Halloween show Oct 31");
    const [, user, opts] = ask.mock.calls[0] as [string, string, { images?: unknown[] }];
    expect(user).toContain("Today is");
    expect(user).toContain("<paste>HALLOWEEN SHOW Oct 31 8pm at The Rickshaw</paste>");
    expect(opts.images).toBeUndefined();
  });
  it("returns null for an unusable answer", async () => {
    expect(await extractUpdate({ site: "{}", text: "hi", timeZone: "UTC", ask: vi.fn().mockResolvedValue("{\"nope\":1}") })).toBeNull();
  });
});
