import { describe, expect, it } from "vitest";
import {
  formatSeattleCalendarDate,
  formatSeattleIsoDate,
  getSeattleNow,
  getNextSeattleWeekdayDate,
  getWeekdayOccurrenceInMonth,
} from "@/lib/listings/time";

describe("getSeattleNow", () => {
  it("reads the previous calendar day before midnight in Seattle", () => {
    expect(getSeattleNow(new Date("2026-09-29T06:30:00Z"))).toEqual({
      dayName: "Monday",
      year: 2026,
      month: 9,
      dayOfMonth: 28,
      minutesSinceMidnight: 1410,
    });
  });

  it("reads the midnight hour as 24, as on the live site", () => {
    expect(getSeattleNow(new Date("2026-09-29T07:30:00Z"))).toEqual({
      dayName: "Tuesday",
      year: 2026,
      month: 9,
      dayOfMonth: 29,
      minutesSinceMidnight: 1470,
    });
  });

  it("maps both copies of the repeated hour to 90 when daylight saving ends", () => {
    expect(getSeattleNow(new Date("2026-11-01T08:30:00Z")).minutesSinceMidnight).toBe(90);
    expect(getSeattleNow(new Date("2026-11-01T09:30:00Z")).minutesSinceMidnight).toBe(90);
  });

  it("maps the skipped hour to 180 when daylight saving starts", () => {
    expect(getSeattleNow(new Date("2027-03-14T10:00:00Z")).minutesSinceMidnight).toBe(180);
  });
});

describe("getWeekdayOccurrenceInMonth", () => {
  it("computes the nth weekday of the month", () => {
    expect(getWeekdayOccurrenceInMonth(1)).toBe(1);
    expect(getWeekdayOccurrenceInMonth(7)).toBe(1);
    expect(getWeekdayOccurrenceInMonth(8)).toBe(2);
    expect(getWeekdayOccurrenceInMonth(29)).toBe(5);
  });
});

describe("getNextSeattleWeekdayDate", () => {
  it("treats the current Seattle weekday as today on Monday evening", () => {
    const now = new Date(Date.UTC(2026, 8, 28, 19));
    const monday = getNextSeattleWeekdayDate("Monday", now);
    expect(monday.isToday).toBe(true);
    expect(formatSeattleIsoDate(monday.date)).toBe("2026-09-28");

    const tuesday = getNextSeattleWeekdayDate("Tuesday", now);
    expect(tuesday.isToday).toBe(false);
    expect(formatSeattleIsoDate(tuesday.date)).toBe("2026-09-29");

    expect(formatSeattleIsoDate(getNextSeattleWeekdayDate("Sunday", now).date)).toBe(
      "2026-10-04"
    );
  });

  it("rolls Monday forward to the next week on Tuesday evening", () => {
    const now = new Date(Date.UTC(2026, 8, 29, 19));
    expect(formatSeattleIsoDate(getNextSeattleWeekdayDate("Monday", now).date)).toBe(
      "2026-10-05"
    );
  });

  it("handles the November DST end boundary", () => {
    const now = new Date(Date.UTC(2026, 10, 1, 19));
    const sunday = getNextSeattleWeekdayDate("Sunday", now);
    expect(sunday.isToday).toBe(true);
    expect(formatSeattleIsoDate(sunday.date)).toBe("2026-11-01");

    expect(formatSeattleIsoDate(getNextSeattleWeekdayDate("Monday", now).date)).toBe(
      "2026-11-02"
    );
  });

  it("handles the March DST start boundary", () => {
    const now = new Date(Date.UTC(2027, 2, 14, 19));
    expect(formatSeattleIsoDate(getNextSeattleWeekdayDate("Saturday", now).date)).toBe(
      "2027-03-20"
    );
  });
});

describe("formatSeattleCalendarDate", () => {
  it("formats the Seattle calendar date in long form", () => {
    expect(formatSeattleCalendarDate(new Date(Date.UTC(2026, 8, 28, 20)))).toBe(
      "September 28, 2026"
    );
  });
});

describe("formatSeattleIsoDate", () => {
  it("formats the Seattle ISO date for a UTC instant before local midnight", () => {
    expect(formatSeattleIsoDate(new Date("2026-09-29T06:30:00Z"))).toBe("2026-09-28");
  });
});
