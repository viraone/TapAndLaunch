import { describe, expect, it } from "vitest";
import { clockToMinutes, computeHappyHour, daysLabel, parseHappyHour, windowTimeLabel } from "@/lib/food/happyHour";
import type { HappyHourWindow } from "@/types/database";

// Seattle in PDT: UTC-7.
const PDT = -420;
/** A UTC Date for a Seattle-local weekday (0 = Sunday) and time. 2026-09-27 is a Sunday. */
const seattle = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 8, 27 + day, hour + 7, minute));

const WEEKDAY_4_TO_6: HappyHourWindow[] = [{ days: [1, 2, 3, 4, 5], start: "16:00", end: "18:00", deal: "$5 drafts" }];

describe("computeHappyHour", () => {
  it("is active inside the window and says when it ends", () => {
    const s = computeHappyHour(WEEKDAY_4_TO_6, PDT, seattle(2, 17, 15));
    expect(s).toEqual({ state: "active", endsInMinutes: 45, endsAtLabel: "6 PM", deal: "$5 drafts" });
  });

  it("is 'later' before the window starts the same day", () => {
    const s = computeHappyHour(WEEKDAY_4_TO_6, PDT, seattle(2, 14, 30));
    expect(s).toEqual({ state: "later", startsInMinutes: 90, startsAtLabel: "4 PM", deal: "$5 drafts" });
  });

  it("is none after the window, on other days, and with no windows", () => {
    expect(computeHappyHour(WEEKDAY_4_TO_6, PDT, seattle(2, 18, 0))).toEqual({ state: "none" });
    expect(computeHappyHour(WEEKDAY_4_TO_6, PDT, seattle(6, 17, 0))).toEqual({ state: "none" });
    expect(computeHappyHour([], PDT, seattle(2, 17, 0))).toEqual({ state: "none" });
    expect(computeHappyHour(null, PDT, seattle(2, 17, 0))).toEqual({ state: "none" });
    expect(computeHappyHour(WEEKDAY_4_TO_6, null, seattle(2, 17, 0))).toEqual({ state: "none" });
  });

  it("does not count tomorrow's window as 'later today'", () => {
    // Friday 7 PM: Saturday has none anyway; Monday's 4 PM is not today.
    expect(computeHappyHour(WEEKDAY_4_TO_6, PDT, seattle(0, 19, 0))).toEqual({ state: "none" });
  });

  it("handles a window past midnight, belonging to the day it started", () => {
    const late: HappyHourWindow[] = [{ days: [5], start: "22:00", end: "01:00", deal: null }];
    expect(computeHappyHour(late, PDT, seattle(5, 23, 0))).toMatchObject({ state: "active", endsInMinutes: 120, endsAtLabel: "1 AM" });
    expect(computeHappyHour(late, PDT, seattle(6, 0, 30))).toMatchObject({ state: "active", endsInMinutes: 30 });
    expect(computeHappyHour(late, PDT, seattle(6, 1, 0))).toEqual({ state: "none" });
  });

  it("wraps the week: a Saturday night window is still running early Sunday", () => {
    const late: HappyHourWindow[] = [{ days: [6], start: "23:00", end: "02:00", deal: null }];
    expect(computeHappyHour(late, PDT, seattle(0, 1, 0))).toMatchObject({ state: "active", endsInMinutes: 60 });
  });

  it("'until close' follows the place's own hours and is off while it's closed", () => {
    const w: HappyHourWindow[] = [{ days: [4], start: "16:00", end: null, deal: null }];
    const open = { closesInMinutes: 300, closesAtLabel: "11 PM" };
    expect(computeHappyHour(w, PDT, seattle(4, 18, 0), open)).toEqual({ state: "active", endsInMinutes: 300, endsAtLabel: "11 PM", deal: null });
    expect(computeHappyHour(w, PDT, seattle(4, 18, 0), null)).toEqual({ state: "none" });
    expect(computeHappyHour(w, PDT, seattle(4, 15, 0), null)).toMatchObject({ state: "later", startsInMinutes: 60 });
  });

  it("with overlapping windows, reports the one that ends first", () => {
    const w: HappyHourWindow[] = [
      { days: [3], start: "15:00", end: "19:00", deal: "A" },
      { days: [3], start: "16:00", end: "17:00", deal: "B" },
    ];
    expect(computeHappyHour(w, PDT, seattle(3, 16, 30))).toMatchObject({ endsInMinutes: 30, deal: "B" });
  });
});

describe("parseHappyHour", () => {
  it("keeps good windows and drops malformed ones", () => {
    const parsed = parseHappyHour({
      windows: [
        { days: [1, 1, 2], start: "16:00", end: "18:00", deal: "  $5 wells " },
        { days: [], start: "16:00", end: "18:00" },
        { days: [1], start: "4pm", end: "6pm" },
        { days: [9], start: "16:00", end: "18:00" },
        { days: [1], start: "16:00", end: "16:00" },
        { days: [5], start: "21:00", end: null },
      ],
    });
    expect(parsed).toEqual([
      { days: [1, 2], start: "16:00", end: "18:00", deal: "$5 wells" },
      { days: [5], start: "21:00", end: null, deal: null },
    ]);
    expect(parseHappyHour(null)).toEqual([]);
    expect(parseHappyHour({ windows: "x" })).toEqual([]);
  });
});

describe("labels", () => {
  it("formats days and times", () => {
    expect(clockToMinutes("16:30")).toBe(990);
    expect(clockToMinutes("25:00")).toBeNull();
    expect(daysLabel([1, 2, 3, 4, 5])).toBe("Mon–Fri");
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(daysLabel([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(daysLabel([6])).toBe("Sat");
    expect(windowTimeLabel({ days: [1], start: "16:00", end: "18:30", deal: null })).toBe("4 PM – 6:30 PM");
    expect(windowTimeLabel({ days: [1], start: "16:00", end: null, deal: null })).toBe("4 PM – close");
  });
});
