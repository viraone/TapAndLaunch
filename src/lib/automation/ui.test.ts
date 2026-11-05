import { describe, expect, it } from "vitest";
import {
  contactPickerEmptyMessage,
  describeSchedule,
  earliestOnceDate,
  filterContacts,
  formatInstant,
  formatTimeOfDay,
  looksLikeEmail,
  mergeRecipients,
  previewValues,
  summarizeRecent,
  tomorrowDate,
} from "./ui";

describe("formatTimeOfDay", () => {
  it("writes an afternoon time the way people say it", () => {
    expect(formatTimeOfDay("19:00")).toBe("7:00 PM");
  });

  it("handles midnight and noon", () => {
    expect(formatTimeOfDay("00:00")).toBe("12:00 AM");
    expect(formatTimeOfDay("12:00")).toBe("12:00 PM");
  });

  it("keeps the minutes and drops the leading zero on the hour", () => {
    expect(formatTimeOfDay("09:05")).toBe("9:05 AM");
    expect(formatTimeOfDay("23:59")).toBe("11:59 PM");
  });

  it("accepts the seconds Postgres returns", () => {
    expect(formatTimeOfDay("19:00:00")).toBe("7:00 PM");
  });

  it("hands back text it cannot read", () => {
    expect(formatTimeOfDay("nope")).toBe("nope");
    expect(formatTimeOfDay("24:00")).toBe("24:00");
    expect(formatTimeOfDay("19:60")).toBe("19:60");
  });
});

describe("describeSchedule", () => {
  it("names the weekday of a weekly reminder", () => {
    expect(
      describeSchedule({
        schedule_kind: "weekly",
        weekday: 4,
        once_date: null,
        send_time: "19:00",
      })
    ).toBe("Every Thursday at 7:00 PM");
  });

  it("names the date of a one-time reminder", () => {
    expect(
      describeSchedule({
        schedule_kind: "once",
        weekday: null,
        once_date: "2026-11-06",
        send_time: "19:00",
      })
    ).toBe("Once on Friday, November 6 at 7:00 PM");
  });

  it("falls back to plain words when the weekday or date is missing", () => {
    expect(
      describeSchedule({
        schedule_kind: "weekly",
        weekday: null,
        once_date: null,
        send_time: "19:00",
      })
    ).toBe("Every week at 7:00 PM");
    expect(
      describeSchedule({
        schedule_kind: "once",
        weekday: null,
        once_date: "not-a-date",
        send_time: "19:00",
      })
    ).toBe("One time at 7:00 PM");
  });
});

describe("formatInstant", () => {
  it("reads a fixed instant in the show's time zone", () => {
    expect(formatInstant("2026-11-06T03:00:00.000Z", "America/Los_Angeles")).toBe(
      "Thu, Nov 5, 7:00 PM"
    );
  });

  it("formats the same instant in a zone without daylight saving", () => {
    expect(formatInstant("2026-11-06T03:00:00.000Z", "UTC")).toBe("Fri, Nov 6, 3:00 AM");
    expect(formatInstant("2026-07-15T19:00:00.000Z", "America/Phoenix")).toBe(
      "Wed, Jul 15, 12:00 PM"
    );
  });

  it("hands back text it cannot read", () => {
    expect(formatInstant("not a date", "UTC")).toBe("not a date");
  });
});

describe("filterContacts", () => {
  const contacts = [
    { name: "Alex Morgan", email: "alex@example.com" },
    { name: "Sam Lee", email: "sam@band.com" },
  ];

  it("returns everybody for an empty query", () => {
    expect(filterContacts(contacts, "   ")).toEqual(contacts);
  });

  it("matches a name without caring about case or spaces", () => {
    expect(filterContacts(contacts, "  MOR ")).toEqual([contacts[0]]);
  });

  it("matches part of an email address", () => {
    expect(filterContacts(contacts, "BAND.com")).toEqual([contacts[1]]);
  });

  it("returns nothing when nobody matches", () => {
    expect(filterContacts(contacts, "zzz")).toEqual([]);
  });
});

describe("contactPickerEmptyMessage", () => {
  it("points at typing an address when Gmail returned nobody", () => {
    expect(contactPickerEmptyMessage(0, 0)).toBe(
      "No contacts found. You can still add email addresses by hand."
    );
  });

  it("says a search matched nobody when the list itself has people", () => {
    expect(contactPickerEmptyMessage(12, 0)).toBe("No contacts match.");
  });

  it("says nothing while there are rows to show", () => {
    expect(contactPickerEmptyMessage(12, 3)).toBeNull();
  });
});

describe("mergeRecipients", () => {
  it("adds new addresses after the current ones, in order", () => {
    expect(
      mergeRecipients(
        [{ name: "Alex", email: "alex@example.com" }],
        [
          { name: null, email: "sam@example.com" },
          { name: "Jo", email: "jo@example.com" },
        ]
      )
    ).toEqual([
      { name: "Alex", email: "alex@example.com" },
      { name: null, email: "sam@example.com" },
      { name: "Jo", email: "jo@example.com" },
    ]);
  });

  it("keeps the first row for an address and ignores it after that", () => {
    expect(
      mergeRecipients(
        [{ name: "Alex", email: "Alex@Example.com" }],
        [{ name: "Someone else", email: "alex@example.com" }]
      )
    ).toEqual([{ name: "Alex", email: "Alex@Example.com" }]);
  });

  it("ignores an addition with no address", () => {
    expect(mergeRecipients([], [{ name: "Nobody", email: "   " }])).toEqual([]);
  });
});

describe("looksLikeEmail", () => {
  it("accepts a normal address, with or without spaces around it", () => {
    expect(looksLikeEmail("alex@example.com")).toBe(true);
    expect(looksLikeEmail("  alex@example.com  ")).toBe(true);
    expect(looksLikeEmail("a@b.c")).toBe(true);
  });

  it("refuses what the server refuses", () => {
    expect(looksLikeEmail("")).toBe(false);
    expect(looksLikeEmail("alex")).toBe(false);
    expect(looksLikeEmail("alex@example")).toBe(false);
    expect(looksLikeEmail("alex example@example.com")).toBe(false);
    expect(looksLikeEmail("alex@example.com, sam@example.com")).toBe(false);
    expect(looksLikeEmail("alex@example.com\nsam@example.com")).toBe(false);
    expect(looksLikeEmail(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("summarizeRecent", () => {
  it("counts what went out", () => {
    expect(summarizeRecent({ sent: 18, failed: 0, sending: 0 })).toBe("18 sent");
  });

  it("mentions failures", () => {
    expect(summarizeRecent({ sent: 17, failed: 1, sending: 0 })).toBe(
      "17 sent, 1 failed"
    );
  });

  it("says a send is still going", () => {
    expect(summarizeRecent({ sent: 0, failed: 0, sending: 3 })).toBe("sending…");
  });

  it("counts zeros plainly", () => {
    expect(summarizeRecent({ sent: 0, failed: 0, sending: 0 })).toBe("0 sent");
  });
});

describe("earliestOnceDate", () => {
  it("uses today's local date in the app's time zone", () => {
    expect(
      earliestOnceDate(new Date("2026-11-05T03:00:00.000Z"), "America/Los_Angeles")
    ).toBe("2026-11-04");
    expect(earliestOnceDate(new Date("2026-11-05T03:00:00.000Z"), "UTC")).toBe(
      "2026-11-05"
    );
  });
});

describe("tomorrowDate", () => {
  it("uses tomorrow's local date in the app's time zone", () => {
    expect(
      tomorrowDate(new Date("2026-11-04T20:00:00.000Z"), "America/Los_Angeles")
    ).toBe("2026-11-05");
  });

  it("rolls over at local midnight, not UTC midnight", () => {
    expect(
      tomorrowDate(new Date("2026-11-05T03:00:00.000Z"), "America/Los_Angeles")
    ).toBe("2026-11-05");
    expect(tomorrowDate(new Date("2026-11-05T03:00:00.000Z"), "UTC")).toBe(
      "2026-11-06"
    );
  });

  it("crosses a month end", () => {
    expect(
      tomorrowDate(new Date("2026-11-30T20:00:00.000Z"), "America/Los_Angeles")
    ).toBe("2026-12-01");
  });
});

describe("previewValues", () => {
  it("gives every token something made-up but readable to show", () => {
    expect(
      previewValues(
        "Sparkle Home Cleaning",
        new Date("2026-11-04T20:00:00.000Z"),
        "America/Los_Angeles"
      )
    ).toEqual({
      first_name: "Alex",
      name: "Alex Morgan",
      show_name: "Sparkle Home Cleaning",
      show_date: "Wednesday, November 4",
      show_time: "",
      venue: "",
      business: "Sparkle Home Cleaning",
    });
  });
});
