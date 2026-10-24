import { describe, expect, it } from "vitest";
import { formatShowDate, formatWeekTime, isLineupTime, isShowDay, isWindowOpen, reopenLabel, showDateFor, type WeeklyWindow } from "./window";

const RTR: WeeklyWindow = {
  timeZone: "America/Los_Angeles",
  opensWeekday: 5,
  opensMinutes: 21 * 60 + 40,
  closesWeekday: 4,
  closesMinutes: 22 * 60,
  showWeekday: 5,
};

// 2026-10-01 is a Thursday; Pacific is UTC-7 (PDT) until Nov 1.
const pdt = (iso: string) => new Date(`${iso}-07:00`);

describe("Read The Room request window", () => {
  it("is open midweek and for the shows coming Friday", () => {
    const now = pdt("2026-09-30T12:00");
    expect(isWindowOpen(RTR, now)).toBe(true);
    expect(formatShowDate(showDateFor(RTR, now))).toBe("Friday, Oct 2");
  });

  it("closes at Thursday 10:00 PM", () => {
    expect(isWindowOpen(RTR, pdt("2026-10-01T21:59"))).toBe(true);
    expect(isWindowOpen(RTR, pdt("2026-10-01T22:00"))).toBe(false);
  });

  it("stays closed through Friday's show and reopens at 9:40 PM for next week", () => {
    expect(isWindowOpen(RTR, pdt("2026-10-02T19:00"))).toBe(false);
    expect(formatShowDate(showDateFor(RTR, pdt("2026-10-02T19:00")))).toBe("Friday, Oct 2");
    expect(isWindowOpen(RTR, pdt("2026-10-02T21:39"))).toBe(false);
    expect(isWindowOpen(RTR, pdt("2026-10-02T21:40"))).toBe(true);
    expect(formatShowDate(showDateFor(RTR, pdt("2026-10-02T21:40")))).toBe("Friday, Oct 9");
  });

  it("is open over the weekend for the next Friday", () => {
    const now = pdt("2026-10-04T10:00");
    expect(isWindowOpen(RTR, now)).toBe(true);
    expect(formatShowDate(showDateFor(RTR, now))).toBe("Friday, Oct 9");
  });

  it("works across the November DST change", () => {
    // Sun Nov 1 2026 is the fallback; Nov 5 is a Thursday in PST (UTC-8).
    expect(isWindowOpen(RTR, new Date("2026-11-05T21:59-08:00"))).toBe(true);
    expect(isWindowOpen(RTR, new Date("2026-11-05T22:00-08:00"))).toBe(false);
    expect(formatShowDate(showDateFor(RTR, new Date("2026-11-01T12:00-08:00")))).toBe("Friday, Nov 6");
  });

  it("says when it reopens in words, depending on the day", () => {
    expect(isShowDay(RTR, pdt("2026-10-02T12:00"))).toBe(true);
    expect(reopenLabel(RTR, pdt("2026-10-02T12:00"))).toBe("after tonight's show");
    expect(isShowDay(RTR, pdt("2026-10-01T22:30"))).toBe(false);
    expect(reopenLabel(RTR, pdt("2026-10-01T22:30"))).toBe("after tomorrow's show");
  });

  it("shows the lineup from Friday 6:00 AM until requests reopen, not before", () => {
    expect(isLineupTime(RTR, pdt("2026-10-01T22:30"))).toBe(false); // Thursday night
    expect(isLineupTime(RTR, pdt("2026-10-02T00:00"))).toBe(false); // midnight
    expect(isLineupTime(RTR, pdt("2026-10-02T05:59"))).toBe(false);
    expect(isLineupTime(RTR, pdt("2026-10-02T06:00"))).toBe(true);
    expect(isLineupTime(RTR, pdt("2026-10-02T21:39"))).toBe(true);
    expect(isLineupTime(RTR, pdt("2026-10-02T21:40"))).toBe(false); // requests are open again
    expect(isLineupTime(RTR, pdt("2026-10-04T10:00"))).toBe(false); // an ordinary open day
  });

  it("can show the lineup earlier, from a time of the window's own (Thursday 11:30 PM)", () => {
    const early: WeeklyWindow = { ...RTR, lineupFromWeekday: 4, lineupFromMinutes: 23 * 60 + 30 };
    expect(isLineupTime(early, pdt("2026-10-01T22:30"))).toBe(false); // closed, but not yet
    expect(isLineupTime(early, pdt("2026-10-01T23:30"))).toBe(true);
    expect(isLineupTime(early, pdt("2026-10-02T00:00"))).toBe(true); // through the night
    expect(isLineupTime(early, pdt("2026-10-02T21:39"))).toBe(true);
    expect(isLineupTime(early, pdt("2026-10-02T21:40"))).toBe(false); // requests are open again
    expect(isLineupTime(early, pdt("2026-10-04T10:00"))).toBe(false);
  });

  it("formats the open/close times", () => {
    expect(formatWeekTime(RTR.opensWeekday, RTR.opensMinutes)).toBe("Fri 9:40 PM");
    expect(formatWeekTime(RTR.closesWeekday, RTR.closesMinutes)).toBe("Thu 10:00 PM");
  });
});

describe("one-off hold (closed_until)", () => {
  // The week of Oct 23, 2026: requests reopen Saturday noon instead of Friday 9:40 PM.
  const HELD: WeeklyWindow = { ...RTR, closedUntil: pdt("2026-10-24T12:00") };

  it("keeps the normal window before the hold", () => {
    expect(isWindowOpen(HELD, pdt("2026-10-21T12:00"))).toBe(true);
    expect(isWindowOpen(HELD, pdt("2026-10-22T22:00"))).toBe(false);
    expect(isLineupTime(HELD, pdt("2026-10-23T19:00"))).toBe(true);
    expect(reopenLabel(HELD, pdt("2026-10-23T12:00"))).toBe("Saturday at 12:00 PM");
  });

  it("stays closed after the show until the hold ends, for the next show", () => {
    const sat = pdt("2026-10-23T21:40");
    expect(isWindowOpen(HELD, sat)).toBe(false);
    expect(isLineupTime(HELD, sat)).toBe(false);
    expect(formatShowDate(showDateFor(HELD, sat))).toBe("Friday, Oct 30");
    expect(reopenLabel(HELD, sat)).toBe("Saturday at 12:00 PM");
    expect(isWindowOpen(HELD, pdt("2026-10-24T11:59"))).toBe(false);
    expect(isWindowOpen(HELD, pdt("2026-10-24T12:00"))).toBe(true);
    expect(formatShowDate(showDateFor(HELD, pdt("2026-10-24T12:00")))).toBe("Friday, Oct 30");
  });

  it("is forgotten the week after", () => {
    expect(isWindowOpen(HELD, pdt("2026-10-30T21:40"))).toBe(true);
    expect(reopenLabel(HELD, pdt("2026-10-30T12:00"))).toBe("after tonight's show");
  });

  it("Oct 30, 2026 (the costume contest): requests reopen at 10:00 PM sharp, not 9:40 PM", () => {
    const TEN: WeeklyWindow = { ...RTR, lineupFromWeekday: 4, lineupFromMinutes: 23 * 60, closedUntil: pdt("2026-10-30T22:00") };
    expect(isLineupTime(TEN, pdt("2026-10-30T19:00"))).toBe(true);
    expect(isWindowOpen(TEN, pdt("2026-10-30T21:40"))).toBe(false);
    expect(isLineupTime(TEN, pdt("2026-10-30T21:50"))).toBe(false);
    expect(reopenLabel(TEN, pdt("2026-10-30T21:50"))).toBe("Friday at 10:00 PM");
    expect(isWindowOpen(TEN, pdt("2026-10-30T21:59"))).toBe(false);
    expect(isWindowOpen(TEN, pdt("2026-10-30T22:00"))).toBe(true);
    expect(formatShowDate(showDateFor(TEN, pdt("2026-10-30T22:00")))).toBe("Friday, Nov 6");
    // Nov 6 is after the clocks go back: 9:40 PM PST is -08:00.
    expect(isWindowOpen(TEN, new Date("2026-11-06T21:40:00-08:00"))).toBe(true);
    expect(isWindowOpen(TEN, new Date("2026-11-06T21:39:00-08:00"))).toBe(false);
  });
});
