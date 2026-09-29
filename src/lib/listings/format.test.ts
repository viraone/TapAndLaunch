import { describe, expect, it } from "vitest";
import { buildOpenMicTimeLabel, formatMinutesToClock } from "@/lib/listings/format";

describe("formatMinutesToClock", () => {
  it("formats minutes since midnight as a 12-hour clock", () => {
    expect(formatMinutesToClock(null)).toBe(null);
    expect(formatMinutesToClock(undefined)).toBe(null);
    expect(formatMinutesToClock(0)).toBe("12:00 AM");
    expect(formatMinutesToClock(30)).toBe("12:30 AM");
    expect(formatMinutesToClock(720)).toBe("12:00 PM");
    expect(formatMinutesToClock(1170)).toBe("7:30 PM");
    expect(formatMinutesToClock(1439)).toBe("11:59 PM");
  });

  it("wraps past midnight and before it, as the live site does", () => {
    expect(formatMinutesToClock(1470)).toBe("12:30 AM");
    expect(formatMinutesToClock(-30)).toBe("11:30 PM");
  });
});

describe("buildOpenMicTimeLabel", () => {
  it("gives the start time, the Spice of Life exception, or says it isn't listed", () => {
    expect(buildOpenMicTimeLabel({ name: "Spice of Life Variety Open Mic", startMinutes: 1170 })).toBe("6:00 PM - Midnight");
    expect(buildOpenMicTimeLabel({ name: "Laughs", startMinutes: 1170 })).toBe("Start 7:30 PM");
    expect(buildOpenMicTimeLabel({ name: "Laughs", startMinutes: null })).toBe("Time not listed");
  });
});
