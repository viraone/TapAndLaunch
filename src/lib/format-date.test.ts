import { describe, expect, it } from "vitest";
import { formatDay, formatDayTime, formatDayTimeRange } from "./format-date";

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
});
