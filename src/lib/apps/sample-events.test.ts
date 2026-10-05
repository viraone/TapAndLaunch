import { describe, expect, it } from "vitest";
import { sampleEventRows, zonedTimeToUtc } from "./sample-events";

describe("zonedTimeToUtc", () => {
  it("converts Pacific wall-clock time in summer and winter", () => {
    expect(zonedTimeToUtc(2026, 7, 1, 18, 0, "America/Los_Angeles").toISOString()).toBe("2026-07-02T01:00:00.000Z");
    expect(zonedTimeToUtc(2026, 12, 1, 18, 0, "America/Los_Angeles").toISOString()).toBe("2026-12-02T02:00:00.000Z");
  });
});

describe("sampleEventRows", () => {
  it("dates each event from today in the zone, with its length and capacity", () => {
    const now = new Date("2026-10-05T20:00:00Z"); // 1pm Monday in Seattle
    const [row] = sampleEventRows("app-1", [{ title: "Yoga", description: "d", dayOffset: 1, time: "18:00", minutes: 60, capacity: 20 }], now);
    expect(row).toMatchObject({ app_id: "app-1", title: "Yoga", capacity: 20, starts_at: "2026-10-07T01:00:00.000Z", ends_at: "2026-10-07T02:00:00.000Z" });
  });
  it("uses the zone's date, not UTC's, near midnight", () => {
    const now = new Date("2026-10-06T05:30:00Z"); // still Monday 10:30pm in Seattle
    const [row] = sampleEventRows("a", [{ title: "x", description: "", dayOffset: 0, time: "09:00", minutes: 30, capacity: 5 }], now);
    expect(row?.starts_at).toBe("2026-10-05T16:00:00.000Z");
  });
});
