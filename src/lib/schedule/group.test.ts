import { describe, expect, it } from "vitest";
import { groupVisitsByDay, splitUpcoming } from "./group";

const LOS_ANGELES = "America/Los_Angeles";

interface Visit {
  id: string;
  starts_at: string;
}

function visit(id: string, startsAt: string): Visit {
  return { id, starts_at: startsAt };
}

describe("groupVisitsByDay", () => {
  it("puts a visit at 11 PM Pacific on that Pacific day, not the UTC day", () => {
    // 2026-11-04T07:00Z is 2026-11-03 23:00 in Los Angeles (PST, UTC-8).
    const lateEvening = visit("a", "2026-11-04T07:00:00.000Z");

    expect(groupVisitsByDay([lateEvening], LOS_ANGELES)).toEqual([
      { date: "2026-11-03", visits: [lateEvening] },
    ]);
  });

  it("makes separate local days out of two visits on the same UTC day", () => {
    // Both are November 4 in UTC; in Los Angeles the first is late on the 3rd.
    const lateEvening = visit("a", "2026-11-04T07:00:00.000Z");
    const morning = visit("b", "2026-11-04T18:00:00.000Z");

    expect(groupVisitsByDay([lateEvening, morning], LOS_ANGELES)).toEqual([
      { date: "2026-11-03", visits: [lateEvening] },
      { date: "2026-11-04", visits: [morning] },
    ]);
  });

  it("orders the days and the visits inside each day oldest first", () => {
    const morning = visit("a", "2026-11-10T18:00:00.000Z");
    const afternoon = visit("b", "2026-11-10T22:00:00.000Z");
    const nextDay = visit("c", "2026-11-11T18:00:00.000Z");

    expect(groupVisitsByDay([nextDay, afternoon, morning], LOS_ANGELES)).toEqual([
      { date: "2026-11-10", visits: [morning, afternoon] },
      { date: "2026-11-11", visits: [nextDay] },
    ]);
  });
});

describe("splitUpcoming", () => {
  it("splits at local midnight, not UTC midnight", () => {
    const now = new Date("2026-11-04T12:00:00.000Z"); // 4:00 AM on Nov 4 in Los Angeles
    const beforeMidnight = visit("a", "2026-11-04T07:59:00.000Z"); // Nov 3, 11:59 PM
    const atMidnight = visit("b", "2026-11-04T08:00:00.000Z"); // Nov 4, 12:00 AM
    const laterThatDay = visit("c", "2026-11-04T18:00:00.000Z"); // Nov 4, 10:00 AM

    expect(
      splitUpcoming([beforeMidnight, atMidnight, laterThatDay], LOS_ANGELES, now)
    ).toEqual({
      upcoming: [atMidnight, laterThatDay],
      earlier: [beforeMidnight],
    });
  });

  it("keeps a visit from an earlier day in the earlier half", () => {
    const now = new Date("2026-11-10T20:00:00.000Z"); // noon on Nov 10 in Los Angeles
    const yesterday = visit("a", "2026-11-09T20:00:00.000Z");
    const today = visit("b", "2026-11-10T16:00:00.000Z");

    expect(splitUpcoming([yesterday, today], LOS_ANGELES, now)).toEqual({
      upcoming: [today],
      earlier: [yesterday],
    });
  });
});
