import { describe, expect, it } from "vitest";
import { formatUpcomingOpenMicDate, getNextOpenMicOccurrenceDate, openMicOccursOnSeattleDate } from "@/lib/listings/recurrence";

function at(year: number, month: number, day: number, dayName: string) {
  return { year, month, dayOfMonth: day, dayName, minutesSinceMidnight: 0 };
}

const JM = { recurrence: { type: "monthly-multiple-nth-weekdays", weekday: "Tuesday", nth: [2, 3, 4] }, days: {}, anchorDate: "" };
const RS = { recurrence: { type: "monthly-multiple-nth-weekdays", weekday: "Tuesday", startDate: "2026-10-13", nth: [2, 4] }, days: {}, anchorDate: "" };

describe("openMicOccursOnSeattleDate", () => {
  it("matches multiple nth weekdays (JM)", () => {
    expect(openMicOccursOnSeattleDate(JM, at(2026, 9, 15, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(JM, at(2026, 9, 8, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(JM, at(2026, 9, 22, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(JM, at(2026, 10, 20, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(JM, at(2026, 9, 1, "Tuesday"))).toBe(false);
    expect(openMicOccursOnSeattleDate(JM, at(2026, 9, 29, "Tuesday"))).toBe(false);
    expect(openMicOccursOnSeattleDate(JM, at(2026, 9, 14, "Monday"))).toBe(false);
  });

  it("respects startDate (RS)", () => {
    expect(openMicOccursOnSeattleDate(RS, at(2026, 9, 22, "Tuesday"))).toBe(false);
    expect(openMicOccursOnSeattleDate(RS, at(2026, 10, 13, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(RS, at(2026, 10, 27, "Tuesday"))).toBe(true);
  });

  it("falls back to days when recurrence is null", () => {
    const mic = { recurrence: null, days: { Monday: true }, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 28, "Monday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 29, "Tuesday"))).toBe(false);
  });

  it("weekly matches days or recurrence weekday", () => {
    const both = { recurrence: { type: "weekly", weekday: "Monday" }, days: { Monday: true, Thursday: true }, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(both, at(2026, 10, 1, "Thursday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(both, at(2026, 10, 2, "Friday"))).toBe(false);

    const friday = { recurrence: { type: "weekly", weekday: "Friday" }, days: {}, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(friday, at(2026, 10, 2, "Friday"))).toBe(true);
  });

  it("biweekly alternates weeks from the anchor (BI)", () => {
    const BI = { recurrence: { type: "biweekly", weekday: "Tuesday", anchorDate: "2026-09-01" }, days: {}, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(BI, at(2026, 9, 1, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(BI, at(2026, 9, 15, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(BI, at(2026, 9, 29, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(BI, at(2026, 8, 18, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(BI, at(2026, 9, 8, "Tuesday"))).toBe(false);
    expect(openMicOccursOnSeattleDate(BI, at(2026, 8, 25, "Tuesday"))).toBe(false);
  });

  it("biweekly without any anchor never occurs; every-other-week uses mic.anchorDate", () => {
    const noAnchor = { recurrence: { type: "biweekly", weekday: "Tuesday" }, days: {}, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(noAnchor, at(2026, 9, 1, "Tuesday"))).toBe(false);

    const eoW = { recurrence: { type: "every-other-week", weekday: "Tuesday" }, days: {}, anchorDate: "2026-09-01" };
    expect(openMicOccursOnSeattleDate(eoW, at(2026, 9, 15, "Tuesday"))).toBe(true);
  });

  it("monthly-nth-weekday with nth -1 is the last weekday of the month", () => {
    const mic = { recurrence: { type: "monthly-nth-weekday", weekday: "Tuesday", nth: -1 }, days: {}, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 29, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 22, "Tuesday"))).toBe(false);
  });

  it("monthly-last-weekday", () => {
    const mic = { recurrence: { type: "monthly-last-weekday", weekday: "Tuesday" }, days: {}, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 29, "Tuesday"))).toBe(true);
  });

  it("monthly-first-and-last-weekday", () => {
    const mic = { recurrence: { type: "monthly-first-and-last-weekday", weekday: "Tuesday" }, days: {}, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 1, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 29, "Tuesday"))).toBe(true);
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 15, "Tuesday"))).toBe(false);
  });

  it("additionalDates override the pattern", () => {
    const mic = { recurrence: { type: "monthly-nth-weekday", weekday: "Tuesday", nth: 2, additionalDates: ["2026-09-30"] }, days: {}, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 30, "Wednesday"))).toBe(true);
  });

  it("unknown types never occur", () => {
    const mic = { recurrence: { type: "yearly", weekday: "Tuesday" }, days: {}, anchorDate: "" };
    expect(openMicOccursOnSeattleDate(mic, at(2026, 9, 1, "Tuesday"))).toBe(false);
    expect(getNextOpenMicOccurrenceDate(mic, new Date(Date.UTC(2026, 8, 28, 20)))).toBeNull();
  });
});

describe("getNextOpenMicOccurrenceDate + formatUpcomingOpenMicDate", () => {
  it("finds the next RS occurrence and formats it", () => {
    expect(formatUpcomingOpenMicDate(getNextOpenMicOccurrenceDate(RS, new Date(Date.UTC(2026, 8, 28, 20)))!)).toBe("Oct 13 2026");
  });

  it("formats a plain date", () => {
    expect(formatUpcomingOpenMicDate(new Date(Date.UTC(2026, 8, 15, 20)))).toBe("Sept 15 2026");
  });
});
