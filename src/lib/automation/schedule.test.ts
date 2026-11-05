import { describe, expect, it } from "vitest";
import {
  CATCH_UP_MINUTES,
  formatLongDate,
  isOccurrenceDue,
  latestOccurrence,
  nextOccurrence,
  showDateAfter,
  type AutomationRule,
} from "./schedule";

const LOS_ANGELES = "America/Los_Angeles";
const MINUTE = 60_000;

/** Thursday 19:00 in Los Angeles. */
const THURSDAY: AutomationRule = {
  scheduleKind: "weekly",
  weekday: 4,
  onceDate: null,
  sendTime: "19:00",
  timeZone: LOS_ANGELES,
};

const ONCE: AutomationRule = {
  scheduleKind: "once",
  weekday: null,
  onceDate: "2026-12-24",
  sendTime: "09:00",
  timeZone: LOS_ANGELES,
};

function iso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

describe("latestOccurrence", () => {
  it("keeps 19:00 local across the end of daylight saving (PDT to PST)", () => {
    // Thursday, October 29 2026 at 11 PM PDT is still the October 29 occurrence.
    expect(iso(latestOccurrence(THURSDAY, new Date("2026-10-30T06:00:00.000Z")))).toBe(
      "2026-10-30T02:00:00.000Z"
    );
    // An hour before the first PST occurrence: last week's PDT instant is the latest.
    expect(iso(latestOccurrence(THURSDAY, new Date("2026-11-06T02:00:00.000Z")))).toBe(
      "2026-10-30T02:00:00.000Z"
    );
    // Thursday, November 5 2026 at 7 PM PST (the clock fell back on November 1).
    expect(iso(latestOccurrence(THURSDAY, new Date("2026-11-06T04:00:00.000Z")))).toBe(
      "2026-11-06T03:00:00.000Z"
    );
  });

  it("keeps 19:00 local across the start of daylight saving (PST to PDT)", () => {
    // Thursday, March 11 2027 at 7 PM PST.
    expect(iso(latestOccurrence(THURSDAY, new Date("2027-03-12T04:00:00.000Z")))).toBe(
      "2027-03-12T03:00:00.000Z"
    );
    // Thursday, March 18 2027 at 7 PM PDT (the clock sprang forward on March 14).
    expect(iso(latestOccurrence(THURSDAY, new Date("2027-03-19T04:00:00.000Z")))).toBe(
      "2027-03-19T02:00:00.000Z"
    );
  });

  it("returns today's occurrence at the exact instant, not last week's", () => {
    const now = new Date("2026-11-06T03:00:00.000Z");

    expect(iso(latestOccurrence(THURSDAY, now))).toBe("2026-11-06T03:00:00.000Z");
  });

  it("returns the one instant of a past 'once' rule", () => {
    expect(iso(latestOccurrence(ONCE, new Date("2027-01-01T00:00:00.000Z")))).toBe(
      "2026-12-24T17:00:00.000Z"
    );
  });

  it("returns null for a future 'once' rule", () => {
    expect(latestOccurrence(ONCE, new Date("2026-12-01T00:00:00.000Z"))).toBeNull();
  });

  it("returns the 'once' instant when now is exactly that instant", () => {
    expect(iso(latestOccurrence(ONCE, new Date("2026-12-24T17:00:00.000Z")))).toBe(
      "2026-12-24T17:00:00.000Z"
    );
  });

  it("uses the instant the clock jumps to for a time in the spring-forward gap", () => {
    // Sunday, March 14 2027: 02:30 does not exist in Los Angeles, so the occurrence is 03:30 PDT.
    const sunday: AutomationRule = {
      scheduleKind: "weekly",
      weekday: 0,
      onceDate: null,
      sendTime: "02:30",
      timeZone: LOS_ANGELES,
    };

    expect(iso(latestOccurrence(sunday, new Date("2027-03-14T12:00:00.000Z")))).toBe(
      "2027-03-14T10:30:00.000Z"
    );
  });

  it("returns null when the rule has no usable weekday or date", () => {
    expect(
      latestOccurrence({ ...THURSDAY, weekday: null }, new Date("2026-11-06T03:00:00.000Z"))
    ).toBeNull();
    expect(
      latestOccurrence({ ...ONCE, onceDate: null }, new Date("2027-01-01T00:00:00.000Z"))
    ).toBeNull();
  });
});

describe("nextOccurrence", () => {
  it("is a week later at the exact instant of an occurrence", () => {
    const now = new Date("2026-11-06T03:00:00.000Z");

    expect(iso(nextOccurrence(THURSDAY, now))).toBe("2026-11-13T03:00:00.000Z");
  });

  it("is later today when the send time has not arrived", () => {
    expect(iso(nextOccurrence(THURSDAY, new Date("2026-11-06T02:00:00.000Z")))).toBe(
      "2026-11-06T03:00:00.000Z"
    );
  });

  it("keeps 19:00 local across the end of daylight saving", () => {
    expect(iso(nextOccurrence(THURSDAY, new Date("2026-10-30T03:00:00.000Z")))).toBe(
      "2026-11-06T03:00:00.000Z"
    );
  });

  it("keeps 19:00 local across the start of daylight saving", () => {
    expect(iso(nextOccurrence(THURSDAY, new Date("2027-03-12T04:00:00.000Z")))).toBe(
      "2027-03-19T02:00:00.000Z"
    );
  });

  it("returns the one instant of a future 'once' rule", () => {
    expect(iso(nextOccurrence(ONCE, new Date("2026-12-01T00:00:00.000Z")))).toBe(
      "2026-12-24T17:00:00.000Z"
    );
  });

  it("returns null for a 'once' rule whose instant has passed", () => {
    expect(nextOccurrence(ONCE, new Date("2026-12-24T17:00:00.000Z"))).toBeNull();
  });

  it("returns the jump instant for a weekly time in the spring-forward gap", () => {
    const sunday: AutomationRule = {
      scheduleKind: "weekly",
      weekday: 0,
      onceDate: null,
      sendTime: "02:30",
      timeZone: LOS_ANGELES,
    };

    expect(iso(nextOccurrence(sunday, new Date("2027-03-14T09:00:00.000Z")))).toBe(
      "2027-03-14T10:30:00.000Z"
    );
  });
});

describe("isOccurrenceDue", () => {
  const occurrence = new Date("2026-11-06T03:00:00.000Z");

  it("is due exactly 90 minutes after the occurrence", () => {
    expect(CATCH_UP_MINUTES).toBe(90);
    expect(
      isOccurrenceDue({ occurrence, now: new Date(occurrence.getTime() + 90 * MINUTE), activatedAt: null })
    ).toBe(true);
  });

  it("is not due one second after the catch-up window closes", () => {
    expect(
      isOccurrenceDue({
        occurrence,
        now: new Date(occurrence.getTime() + 90 * MINUTE + 1000),
        activatedAt: null,
      })
    ).toBe(false);
  });

  it("is not due for an occurrence in the future", () => {
    expect(
      isOccurrenceDue({
        occurrence: new Date(occurrence.getTime() + MINUTE),
        now: occurrence,
        activatedAt: null,
      })
    ).toBe(false);
  });

  it("is not due for an occurrence from before the reminder was switched on", () => {
    expect(
      isOccurrenceDue({
        occurrence,
        now: new Date(occurrence.getTime() + MINUTE),
        activatedAt: new Date(occurrence.getTime() + 1000),
      })
    ).toBe(false);
  });

  it("is due when the reminder was switched on exactly at the occurrence", () => {
    expect(
      isOccurrenceDue({ occurrence, now: new Date(occurrence.getTime() + MINUTE), activatedAt: occurrence })
    ).toBe(true);
  });

  it("is due with no activation time", () => {
    expect(
      isOccurrenceDue({ occurrence, now: new Date(occurrence.getTime() + MINUTE), activatedAt: null })
    ).toBe(true);
  });
});

describe("showDateAfter", () => {
  // Thursday, November 5 2026 at 7 PM PST.
  const occurrence = new Date("2026-11-06T03:00:00.000Z");

  it("returns the occurrence's own date when the send day is the show day", () => {
    expect(showDateAfter(occurrence, 4, LOS_ANGELES)).toBe("2026-11-05");
  });

  it("returns the next day when the send day is the day before the show", () => {
    expect(showDateAfter(occurrence, 5, LOS_ANGELES)).toBe("2026-11-06");
  });

  it("returns the next show day later in the week", () => {
    expect(showDateAfter(occurrence, 6, LOS_ANGELES)).toBe("2026-11-07");
  });

  it("wraps to next week when this week's show day already passed", () => {
    expect(showDateAfter(occurrence, 3, LOS_ANGELES)).toBe("2026-11-11");
  });

  it("uses the occurrence's local date, not its UTC date", () => {
    // 11 PM on November 5 in Pacific is already November 6 in UTC.
    expect(showDateAfter(new Date("2026-11-06T07:00:00.000Z"), 4, LOS_ANGELES)).toBe("2026-11-05");
  });
});

describe("formatLongDate", () => {
  it("writes a local date the way the email should read", () => {
    expect(formatLongDate("2026-11-06")).toBe("Friday, November 6");
    expect(formatLongDate("2027-03-14")).toBe("Sunday, March 14");
  });

  it("does not shift the date by a time zone", () => {
    expect(formatLongDate("2026-01-01")).toBe("Thursday, January 1");
  });

  it("rejects a date that does not exist", () => {
    expect(() => formatLongDate("2026-02-30")).toThrow("Invalid date");
    expect(() => formatLongDate("11/06/2026")).toThrow("Invalid date");
  });
});
