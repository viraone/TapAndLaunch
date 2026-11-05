import { describe, expect, it } from "vitest";
import { countVisitsWithin, localDayBounds, localDaysBounds, visitsWithin } from "./day";

const HOUR_MS = 3_600_000;
const LA = "America/Los_Angeles";

describe("localDayBounds", () => {
  it("spans a normal 24-hour day", () => {
    const { start, end } = localDayBounds("2026-06-01", LA);
    expect(start.toISOString()).toBe("2026-06-01T07:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-02T07:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(24 * HOUR_MS);
  });

  it("spans the 25-hour day when daylight saving ends", () => {
    const { start, end } = localDayBounds("2026-11-01", LA);
    expect(start.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T08:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(25 * HOUR_MS);
  });

  it("spans the 23-hour day when daylight saving starts", () => {
    const { start, end } = localDayBounds("2027-03-14", LA);
    expect(start.toISOString()).toBe("2027-03-14T08:00:00.000Z");
    expect(end.toISOString()).toBe("2027-03-15T07:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(23 * HOUR_MS);
  });

  it("uses the zone's midnight, not UTC's", () => {
    const { start, end } = localDayBounds("2026-11-01", "Asia/Tokyo");
    expect(start.toISOString()).toBe("2026-10-31T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T15:00:00.000Z");
  });

  it("is half-open, so one day ends exactly where the next starts", () => {
    const first = localDayBounds("2026-11-01", LA);
    const second = localDayBounds("2026-11-02", LA);
    expect(first.end.getTime()).toBe(second.start.getTime());
  });
});

describe("localDaysBounds", () => {
  it("counts the real hours across a 25-hour day", () => {
    const week = localDaysBounds("2026-11-01", 7, LA);
    expect(week.start.toISOString()).toBe("2026-11-01T07:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-11-08T08:00:00.000Z");
    expect(week.end.getTime() - week.start.getTime()).toBe((7 * 24 + 1) * HOUR_MS);
  });

  it("rejects a day count that is not a whole number of days", () => {
    expect(() => localDaysBounds("2026-11-01", 1.5, LA)).toThrow("Invalid day count");
    expect(() => localDaysBounds("2026-11-01", -1, LA)).toThrow("Invalid day count");
  });
});

describe("visits within a window", () => {
  const bounds = localDayBounds("2026-11-01", LA);
  const visits = [
    { id: "before", starts_at: "2026-11-01T06:59:59.000Z", status: "scheduled" },
    { id: "first", starts_at: "2026-11-01T07:00:00.000Z", status: "scheduled" },
    { id: "second", starts_at: "2026-11-01T09:00:00.000Z", status: "confirmed" },
    { id: "cancelled", starts_at: "2026-11-01T10:00:00.000Z", status: "cancelled" },
    { id: "end", starts_at: "2026-11-02T08:00:00.000Z", status: "scheduled" },
  ];

  it("includes the start instant and excludes the end instant, soonest first", () => {
    expect(visitsWithin(visits, bounds).map((visit) => visit.id)).toEqual(["first", "second", "cancelled"]);
  });

  it("can count only the statuses that still happen", () => {
    expect(countVisitsWithin(visits, bounds)).toBe(3);
    expect(countVisitsWithin(visits, bounds, ["scheduled", "confirmed"])).toBe(2);
  });
});
