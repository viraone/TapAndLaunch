import { describe, expect, it } from "vitest";
import { computeOpenStatus, formatClock, localWeekMinute } from "@/lib/food/hours";
import type { OpeningPeriod } from "@/types/database";

// Seattle in PDT: UTC-7 → -420 minutes.
const PDT = -420;

/** A UTC Date for a given Seattle-local weekday/time (PDT). */
function seattle(day: number, hour: number, minute = 0): Date {
  // 2026-09-27 is a Sunday. Local time = UTC - 7h, so UTC = local + 7h.
  const base = Date.UTC(2026, 8, 27 + day, hour + 7, minute);
  return new Date(base);
}

const DAILY_11_TO_21: OpeningPeriod[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  open: { day, hour: 11, minute: 0 },
  close: { day, hour: 21, minute: 0 },
}));

describe("hours", () => {
  it("formats clock times", () => {
    expect(formatClock(11 * 60)).toBe("11 AM");
    expect(formatClock(21 * 60 + 30)).toBe("9:30 PM");
    expect(formatClock(0)).toBe("12 AM");
    expect(formatClock(12 * 60)).toBe("12 PM");
  });

  it("converts a UTC instant into the place's local week-minute", () => {
    // Tuesday 3:15 PM Seattle
    expect(localWeekMinute(seattle(2, 15, 15), PDT)).toBe(2 * 1440 + 15 * 60 + 15);
  });

  it("is open mid-afternoon with the closing time", () => {
    const s = computeOpenStatus(DAILY_11_TO_21, PDT, seattle(2, 15));
    expect(s).toEqual({ state: "open", closesInMinutes: 6 * 60, closesAtLabel: "9 PM" });
  });

  it("is closing soon within 30 minutes of close", () => {
    const s = computeOpenStatus(DAILY_11_TO_21, PDT, seattle(2, 20, 40));
    expect(s).toEqual({ state: "closing_soon", closesInMinutes: 20, closesAtLabel: "9 PM" });
  });

  it("is closed in the morning and says when it opens today", () => {
    const s = computeOpenStatus(DAILY_11_TO_21, PDT, seattle(2, 9));
    expect(s).toEqual({ state: "closed", opensInMinutes: 120, opensAtLabel: "11 AM" });
  });

  it("is closed late at night and names the next day", () => {
    const s = computeOpenStatus(DAILY_11_TO_21, PDT, seattle(2, 23));
    expect(s.state).toBe("closed");
    if (s.state === "closed") expect(s.opensAtLabel).toBe("Wed 11 AM");
  });

  it("handles a period that closes after midnight", () => {
    const lateNight: OpeningPeriod[] = [{ open: { day: 5, hour: 17, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }];
    // Saturday 1 AM is still inside Friday's period.
    expect(computeOpenStatus(lateNight, PDT, seattle(6, 1)).state).toBe("open");
    expect(computeOpenStatus(lateNight, PDT, seattle(6, 1, 45)).state).toBe("closing_soon");
    expect(computeOpenStatus(lateNight, PDT, seattle(6, 3)).state).toBe("closed");
  });

  it("handles Saturday-night hours that wrap into Sunday", () => {
    const wrap: OpeningPeriod[] = [{ open: { day: 6, hour: 22, minute: 0 }, close: { day: 0, hour: 1, minute: 0 } }];
    expect(computeOpenStatus(wrap, PDT, seattle(0, 0, 30)).state).toBe("closing_soon");
    expect(computeOpenStatus(wrap, PDT, seattle(6, 22, 30)).state).toBe("open");
  });

  it("treats a single open-with-no-close period as 24/7", () => {
    const always: OpeningPeriod[] = [{ open: { day: 0, hour: 0, minute: 0 } }];
    expect(computeOpenStatus(always, PDT, seattle(3, 4))).toEqual({ state: "open", closesInMinutes: null, closesAtLabel: null });
  });

  it("is unknown without hours or an offset", () => {
    expect(computeOpenStatus([], PDT).state).toBe("unknown");
    expect(computeOpenStatus(DAILY_11_TO_21, null).state).toBe("unknown");
  });
});
