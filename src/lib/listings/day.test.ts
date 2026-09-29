import { describe, expect, it } from "vitest";
import { buildOpenMicDay, filterOpenMicsByType } from "@/lib/listings/day";
import { normalizeOpenMicRecord, type OpenMic } from "@/lib/listings/record";

const NO_DAYS = { monday: "no", tuesday: "no", wednesday: "no", thursday: "no", friday: "no", saturday: "no", sunday: "no" };
const EARLY = { ...NO_DAYS, id: "early", name: "Early Mic", timeSignupStart: "6pm/7pm", monday: "Yes", openMicType: "Comedy" };
const LATE = { ...NO_DAYS, id: "late", name: "Late Mic", timeSignupStart: "9pm", monday: "Yes", openMicType: "Music & Comedy" };
const TUESDAY = { ...NO_DAYS, id: "tuesday", name: "Tuesday Mic", timeSignupStart: "8pm", tuesday: "Yes" };
// Every other Monday from 5 Oct, so off on 28 Sept; shown locked when off.
const EVERY_OTHER = { ...NO_DAYS, id: "every-other", name: "Every Other Mic", timeSignupStart: "8pm", showWhenInactive: true,
  recurrence: { type: "biweekly", weekday: "Monday", anchorDate: "2026-10-05" } };

// Monday 28 Sept 2026 in Seattle (PDT is UTC-7).
const MONDAY_NOON = new Date("2026-09-28T19:00:00Z");
const MONDAY_9_30_PM = new Date("2026-09-29T04:30:00Z");

function mics(...records: Record<string, unknown>[]): OpenMic[] {
  return records.map((record) => normalizeOpenMicRecord(record)).filter((mic): mic is OpenMic => mic !== null);
}

describe("filterOpenMicsByType", () => {
  it("keeps comedy-only mics under Comedy and the rest under Music & Variety", () => {
    const all = mics(EARLY, LATE, TUESDAY);
    expect(filterOpenMicsByType(all, "all").map((m) => m.id)).toEqual(["early", "late", "tuesday"]);
    expect(filterOpenMicsByType(all, "comedy").map((m) => m.id)).toEqual(["early"]);
    expect(filterOpenMicsByType(all, "variety").map((m) => m.id)).toEqual(["late"]);
  });
});

describe("buildOpenMicDay", () => {
  it("shows today in Seattle by default, in start-time order, with next and last", () => {
    const day = buildOpenMicDay(mics(LATE, TUESDAY, EARLY), MONDAY_NOON, null, "all");
    expect(day.dayName).toBe("Monday");
    expect(day.dateLabel).toBe("September 28, 2026");
    expect(day.isToday).toBe(true);
    expect(day.cards.map((c) => [c.mic.id, c.isNext])).toEqual([["early", true], ["late", false]]);
    expect(day.lastMic?.id).toBe("late");
    expect(day.status).toBeNull();
  });

  it("moves next to the mic that has most recently started", () => {
    const day = buildOpenMicDay(mics(EARLY, LATE), MONDAY_9_30_PM, null, "all");
    expect(day.nextMic?.id).toBe("late");
  });

  it("shows another chosen day as its next date, not today", () => {
    const day = buildOpenMicDay(mics(EARLY, TUESDAY), MONDAY_NOON, "Tuesday", "all");
    expect(day.dayName).toBe("Tuesday");
    expect(day.dateLabel).toBe("September 29, 2026");
    expect(day.isToday).toBe(false);
    expect(day.cards.map((c) => c.mic.id)).toEqual(["tuesday"]);
    expect(buildOpenMicDay(mics(EARLY), MONDAY_NOON, "Sunday", "all").dateLabel).toBe("October 4, 2026");
  });

  it("adds a skipped week as a locked card with its next date, in time order", () => {
    const day = buildOpenMicDay(mics(EARLY, LATE, EVERY_OTHER), MONDAY_NOON, null, "all");
    expect(day.cards.map((c) => [c.mic.id, c.upcomingDate?.toISOString() ?? null])).toEqual([
      ["early", null],
      ["every-other", "2026-10-05T20:00:00.000Z"],
      ["late", null],
    ]);
    expect(day.todays.map((m) => m.id)).toEqual(["early", "late"]);
    expect(buildOpenMicDay(mics(EVERY_OTHER), new Date("2026-10-05T19:00:00Z"), null, "all").cards[0].upcomingDate).toBeNull();
  });

  it("puts the nearest first among mics starting at the same time, once there is a location", () => {
    const far = { ...NO_DAYS, id: "far", name: "A Far Mic", timeSignupStart: "7pm", monday: "Yes", latitude: 47.25, longitude: -122.44 };
    const near = { ...NO_DAYS, id: "near", name: "Z Near Mic", timeSignupStart: "7pm", monday: "Yes", latitude: 47.62, longitude: -122.32 };
    expect(buildOpenMicDay(mics(far, near), MONDAY_NOON, null, "all").todays.map((m) => m.id)).toEqual(["far", "near"]);
    expect(
      buildOpenMicDay(mics(far, near), MONDAY_NOON, null, "all", { latitude: 47.6205, longitude: -122.3212 }).todays.map((m) => m.id)
    ).toEqual(["near", "far"]);
  });

  it("says why the list is empty", () => {
    expect(buildOpenMicDay(mics(EARLY), MONDAY_NOON, "Wednesday", "all").status).toBe("No open mics listed for this day.");
    expect(buildOpenMicDay(mics(TUESDAY), MONDAY_NOON, null, "all").status).toBe("No open mics listed for today.");
    expect(buildOpenMicDay(mics(LATE), MONDAY_NOON, null, "comedy").status).toBe(
      "No matching open mics for today. Try clearing the type filter."
    );
    expect(buildOpenMicDay(mics(TUESDAY), MONDAY_NOON, null, "all").cards).toEqual([]);
  });
});
