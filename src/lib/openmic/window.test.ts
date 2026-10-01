import { describe, expect, it } from "vitest";
import { formatShowDate, formatWeekTime, isWindowOpen, showDateFor, type WeeklyWindow } from "./window";

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

  it("formats the open/close times", () => {
    expect(formatWeekTime(RTR.opensWeekday, RTR.opensMinutes)).toBe("Fri 9:40 PM");
    expect(formatWeekTime(RTR.closesWeekday, RTR.closesMinutes)).toBe("Thu 10:00 PM");
  });
});
