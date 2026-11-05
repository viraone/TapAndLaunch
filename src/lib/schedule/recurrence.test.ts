import { describe, expect, it } from "vitest";
import {
  addDays,
  localDateOf,
  occurrencesBetween,
  zonedTimeToUtc,
  type SeriesRule,
} from "./recurrence";

const LOS_ANGELES = "America/Los_Angeles";
const LONDON = "Europe/London";

function isoStarts(
  rule: SeriesRule,
  fromDate: string,
  untilDate: string,
  timeZone = LOS_ANGELES
): string[] {
  return occurrencesBetween(rule, fromDate, untilDate, timeZone).map((date) =>
    date.toISOString()
  );
}

function localDates(
  rule: SeriesRule,
  fromDate: string,
  untilDate: string,
  timeZone = LOS_ANGELES
): string[] {
  return occurrencesBetween(rule, fromDate, untilDate, timeZone).map((date) =>
    localDateOf(date, timeZone)
  );
}

describe("occurrencesBetween", () => {
  it("returns weekly occurrences across the end of daylight saving in Los Angeles", () => {
    const rule: SeriesRule = {
      startsOn: "2026-10-20",
      startTime: "10:00",
      intervalWeeks: 1,
      endsOn: "2026-11-10",
    };

    expect(isoStarts(rule, "2026-10-20", "2026-11-10")).toEqual([
      "2026-10-20T17:00:00.000Z",
      "2026-10-27T17:00:00.000Z",
      "2026-11-03T18:00:00.000Z",
      "2026-11-10T18:00:00.000Z",
    ]);
  });

  it("returns every-two-weeks occurrences in Los Angeles", () => {
    const rule: SeriesRule = {
      startsOn: "2026-10-06",
      startTime: "10:00",
      intervalWeeks: 2,
      endsOn: null,
    };

    expect(isoStarts(rule, "2026-10-06", "2026-11-17")).toEqual([
      "2026-10-06T17:00:00.000Z",
      "2026-10-20T17:00:00.000Z",
      "2026-11-03T18:00:00.000Z",
      "2026-11-17T18:00:00.000Z",
    ]);
  });

  it("keeps 10:00 local across the start of daylight saving", () => {
    const rule: SeriesRule = {
      startsOn: "2027-03-07",
      startTime: "10:00",
      intervalWeeks: 1,
      endsOn: "2027-03-21",
    };

    expect(isoStarts(rule, "2027-03-07", "2027-03-21")).toEqual([
      "2027-03-07T18:00:00.000Z",
      "2027-03-14T17:00:00.000Z",
      "2027-03-21T17:00:00.000Z",
    ]);
  });

  it("includes the endsOn date", () => {
    const rule: SeriesRule = {
      startsOn: "2026-10-06",
      startTime: "10:00",
      intervalWeeks: 1,
      endsOn: "2026-10-20",
    };

    expect(localDates(rule, "2026-10-01", "2026-12-31")).toEqual([
      "2026-10-06",
      "2026-10-13",
      "2026-10-20",
    ]);
  });

  it("keeps the original cadence when the window starts mid-series", () => {
    const rule: SeriesRule = {
      startsOn: "2026-10-06",
      startTime: "10:00",
      intervalWeeks: 2,
      endsOn: null,
    };

    expect(localDates(rule, "2026-10-21", "2026-11-17")).toEqual([
      "2026-11-03",
      "2026-11-17",
    ]);
  });

  it("returns nothing when fromDate is later than untilDate", () => {
    const rule: SeriesRule = {
      startsOn: "2026-10-06",
      startTime: "10:00",
      intervalWeeks: 1,
      endsOn: null,
    };

    expect(isoStarts(rule, "2026-11-01", "2026-10-01")).toEqual([]);
  });

  it("returns nothing for malformed dates, times and intervals", () => {
    const base: SeriesRule = {
      startsOn: "2026-10-06",
      startTime: "10:00",
      intervalWeeks: 1,
      endsOn: null,
    };
    const from = "2026-10-01";
    const until = "2026-12-31";

    expect(
      occurrencesBetween({ ...base, intervalWeeks: 0 }, from, until, LOS_ANGELES)
    ).toEqual([]);
    expect(
      occurrencesBetween(
        { ...base, intervalWeeks: 13 },
        from,
        until,
        LOS_ANGELES
      )
    ).toEqual([]);
    expect(
      occurrencesBetween(
        { ...base, intervalWeeks: 1.5 },
        from,
        until,
        LOS_ANGELES
      )
    ).toEqual([]);
    expect(
      occurrencesBetween(
        { ...base, startsOn: "2026-02-30" },
        from,
        until,
        LOS_ANGELES
      )
    ).toEqual([]);
    expect(
      occurrencesBetween(
        { ...base, startTime: "25:00" },
        from,
        until,
        LOS_ANGELES
      )
    ).toEqual([]);
    expect(
      occurrencesBetween(
        { ...base, startTime: "9:00" },
        from,
        until,
        LOS_ANGELES
      )
    ).toEqual([]);
    expect(
      occurrencesBetween(base, from, "2026-13-01", LOS_ANGELES)
    ).toEqual([]);
    expect(
      occurrencesBetween(
        { ...base, endsOn: "nope" },
        from,
        until,
        LOS_ANGELES
      )
    ).toEqual([]);
  });

  it("returns nothing for an unknown time zone", () => {
    const rule: SeriesRule = {
      startsOn: "2026-10-06",
      startTime: "10:00",
      intervalWeeks: 1,
      endsOn: null,
    };

    expect(
      occurrencesBetween(rule, "2026-10-01", "2026-12-31", "Not/AZone")
    ).toEqual([]);
  });

  it("works across a daylight-saving change in a non-US time zone", () => {
    const rule: SeriesRule = {
      startsOn: "2026-10-20",
      startTime: "09:00",
      intervalWeeks: 1,
      endsOn: null,
    };

    expect(isoStarts(rule, "2026-10-20", "2026-11-03", LONDON)).toEqual([
      "2026-10-20T08:00:00.000Z",
      "2026-10-27T09:00:00.000Z",
      "2026-11-03T09:00:00.000Z",
    ]);
  });

  it("caps the result at 500 occurrences", () => {
    const rule: SeriesRule = {
      startsOn: "2020-01-07",
      startTime: "10:00",
      intervalWeeks: 1,
      endsOn: null,
    };
    const results = occurrencesBetween(
      rule,
      "2020-01-07",
      "2035-12-31",
      LOS_ANGELES
    );

    expect(results).toHaveLength(500);
    expect(localDateOf(results[0], LOS_ANGELES)).toBe("2020-01-07");
    expect(localDateOf(results[499], LOS_ANGELES)).toBe(
      addDays("2020-01-07", 499 * 7)
    );
  });
});

describe("zonedTimeToUtc", () => {
  it("converts a local wall time to the correct UTC instant", () => {
    expect(
      zonedTimeToUtc("2026-11-03", "10:00", LOS_ANGELES).toISOString()
    ).toBe("2026-11-03T18:00:00.000Z");
    expect(
      zonedTimeToUtc("2026-07-01", "10:00", LOS_ANGELES).toISOString()
    ).toBe("2026-07-01T17:00:00.000Z");
  });

  it("accepts seconds in the wall time", () => {
    expect(
      zonedTimeToUtc("2026-11-03", "10:30:00", LOS_ANGELES).toISOString()
    ).toBe("2026-11-03T18:30:00.000Z");
  });

  it("moves a nonexistent spring-forward time one hour later", () => {
    const instant = zonedTimeToUtc("2027-03-14", "02:30", LOS_ANGELES);

    expect(instant.toISOString()).toBe("2027-03-14T10:30:00.000Z");
    expect(localDateOf(instant, LOS_ANGELES)).toBe("2027-03-14");
  });
});

describe("localDateOf", () => {
  it("returns the local date of an instant", () => {
    expect(
      localDateOf(new Date("2026-11-04T02:00:00.000Z"), LOS_ANGELES)
    ).toBe("2026-11-03");
  });
});

describe("addDays", () => {
  it("adds days across month, year and leap boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});
