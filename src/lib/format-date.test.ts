import { describe, expect, it } from "vitest";
import { formatClock, formatDay, formatDayTime, formatDayTimeRange } from "./format-date";

const start = new Date("2026-10-08T02:00:00Z"); // Oct 7, 7:00 PM in Seattle
describe("format-date", () => {
  it("formats a day and time the same way everywhere", () => {
    expect(formatDay(start, "America/Los_Angeles")).toBe("Oct 7, 2026");
    expect(formatDayTime(start, "America/Los_Angeles")).toBe("Oct 7, 2026 · 7:00 PM");
  });
  it("has no narrow or no-break spaces that differ between engines", () => {
    expect(formatDayTime(start, "America/Los_Angeles")).not.toMatch(/[  ]/);
  });
  it("shows just the end time on the same day, and the end date otherwise", () => {
    expect(formatDayTimeRange(start, new Date("2026-10-08T04:00:00Z"), "America/Los_Angeles")).toBe("Oct 7, 2026 · 7:00 PM – 9:00 PM");
    expect(formatDayTimeRange(start, new Date("2026-10-08T08:00:00Z"), "America/Los_Angeles")).toBe("Oct 7, 2026 · 7:00 PM – Oct 8, 2026 · 1:00 AM");
    expect(formatDayTimeRange(start, null, "America/Los_Angeles")).toBe("Oct 7, 2026 · 7:00 PM");
  });
  it("formats the Seattle clock with no leading zero, seconds or zone name", () => {
    const seattle = (iso: string) => formatClock(new Date(iso), "America/Los_Angeles");
    expect(seattle("2026-11-06T20:41:00Z")).toBe("12:41 PM");
    expect(seattle("2026-07-04T02:05:00Z")).toBe("7:05 PM");
    expect(seattle("2026-11-06T08:00:00Z")).toBe("12:00 AM");
    expect(seattle("2026-11-06T20:00:00Z")).toBe("12:00 PM");
    expect(seattle("2026-11-01T09:30:00Z")).toBe("1:30 AM"); // just after the fall-back, so PST (UTC-8)
  });
});
