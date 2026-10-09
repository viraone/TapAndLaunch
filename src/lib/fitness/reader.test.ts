import { describe, expect, it } from "vitest";
import { makeHelpers } from "../../../tools/class-ingest/helpers.mjs";

// The class reader's date and text rules (tools/class-ingest/helpers.mjs). Most of the reader's bugs have been date bugs:
// a week strip that starts on a past Sunday read as next month, "09 OCT" headings, two-line headers, a whole fortnight
// printed under every day tab. Each is pinned here with "today" fixed to Wednesday 2026-10-07.
const h = makeHelpers("2026-10-07");

describe("dateFromLabel", () => {
  it.each([
    ["Today 10/06", "2026-10-06"],
    ["Thursday 10/08", "2026-10-08"],
    ["Wed 7", "2026-10-07"],
    ["T 6", "2026-10-06"],
    ["7 Wed", "2026-10-07"],
    ["Oct 7 Thu", "2026-10-07"],
    ["Tue, Oct 06", "2026-10-06"],
    ["WEDNESDAY, OCTOBER 7", "2026-10-07"],
    ["Mon October 5, 2026", "2026-10-05"],
    ["Tomorrow Wed", "2026-10-08"],
    ["2026-10-12", "2026-10-12"],
  ])("reads %s as %s", (label, iso) => {
    expect(h.dateFromLabel(label)).toBe(iso);
  });

  it("reads a bare 'Today' as today and a bare weekday as its next day", () => {
    expect(h.dateFromLabel("Today")).toBe("2026-10-07");
    expect(h.dateFromLabel("Fri")).toBe("2026-10-09");
  });

  it("keeps a past day of a week strip in this month (Sunday the 4th on Wednesday the 7th)", () => {
    expect(h.dateFromLabel("SUN 4")).toBe("2026-10-04");
    expect(h.dateFromLabel("MON 5")).toBe("2026-10-05");
  });

  it("reads a day-before-month heading like 'FRIDAY 09 OCT'", () => {
    expect(h.dateFromLabel("FRIDAY 09 OCT")).toBe("2026-10-09");
    expect(h.dateFromLabel("22 Oct")).toBe("2026-10-22");
  });

  it("gives null for a label that names no day", () => {
    expect(h.dateFromLabel("Book now")).toBeNull();
    expect(h.dateFromLabel("05")).toBeNull();
    expect(h.dateFromLabel("")).toBeNull();
  });

  it("rolls into the next month and year only when the number is well below today's", () => {
    const late = makeHelpers("2026-10-29");
    expect(late.dateFromLabel("Sun 1")).toBe("2026-11-01");
    expect(late.dateFromLabel("Nov 4")).toBe("2026-11-04");
    const newYear = makeHelpers("2026-12-30");
    expect(newYear.dateFromLabel("Jan 2")).toBe("2027-01-02");
    expect(newYear.dateFromLabel("Fri 1")).toBe("2027-01-01");
  });
});

describe("DAY_HEADING", () => {
  it.each(["Wed, Oct 07", "WEDNESDAY, OCTOBER 7", "Mon October 5, 2026", "Thursday 10/08", "FRIDAY 09 OCT", "October 5th"])("matches %s", (line) => {
    expect(h.DAY_HEADING.test(line)).toBe(true);
  });
  it.each(["05:30", "Book now", "Yoga Sculpt", "Fri 9"])("does not match %s", (line) => {
    expect(h.DAY_HEADING.test(line)).toBe(false);
  });
});

describe("dayPieces", () => {
  it("splits at the reader's own day markers and dates each piece from its label", () => {
    const pieces = h.dayPieces("[Day tab shown: Wed 7]\n9:00 AM Yoga\n\n[Day tab shown: Thu 8]\n10:00 AM Flow");
    expect(pieces.map((p: { date: string | null }) => p.date)).toEqual(["2026-10-07", "2026-10-08"]);
    expect(pieces[1].text).toContain("Flow");
  });

  it("splits an unmarked page at dated headings when at least three of them are there", () => {
    const text = ["Menu", "Wed, Oct 07", "9:00 AM Yoga", "Thu, Oct 08", "9:00 AM Flow", "Fri, Oct 09", "9:00 AM Barre"].join("\n");
    const pieces = h.dayPieces(text);
    expect(pieces.map((p: { date: string | null }) => p.date)).toEqual([null, "2026-10-07", "2026-10-08", "2026-10-09"]);
  });

  it("joins a header printed over two lines ('MON' above '05') when a week of classes hangs under it", () => {
    const lines = ["SUN", "04", "MON", "05", "12:15 PM - 1:30 PM", "YOGA", "TUE", "06", "9:00 AM - 10:00 AM", "BARRE", "WED", "07", "5:00 PM - 6:00 PM", "CYCLING"];
    const pieces = h.dayPieces(lines.join("\n"));
    const dates = pieces.map((p: { date: string | null }) => p.date);
    expect(dates).toContain("2026-10-05");
    expect(dates).toContain("2026-10-06");
    expect(dates).toContain("2026-10-07");
    expect(pieces.find((p: { date: string | null }) => p.date === "2026-10-06")?.text).toContain("BARRE");
  });

  it("does not split a strip of day buttons that sits above one day's classes", () => {
    const lines = ["SUN 04", "MON 05", "TUE 06", "WED 07", "THU 08", "9:00 AM Yoga", "10:00 AM Flow"];
    const pieces = h.dayPieces(lines.join("\n"));
    expect(pieces).toHaveLength(1);
    expect(pieces[0].date).toBeNull();
  });

  it("lets dated headings win over a tab label when a tab shows the whole fortnight (F45 Eastlake)", () => {
    const fortnight = ["FRIDAY 09 OCT", "05:30", "Vegas", "SATURDAY 10 OCT", "08:00", "Vegas", "SUNDAY 11 OCT", "09:00", "Vegas"].join("\n");
    const pieces = h.dayPieces(`[Day tab shown: Sat 10]\n${fortnight}`);
    // The label's own day (Sat 10) is ignored; the three headings give three pieces, and the empty text before them is dropped.
    expect(pieces.map((p: { date: string | null }) => p.date)).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(pieces[1].text).toContain("08:00");
  });
});

describe("trimToTimes", () => {
  it("keeps the lines around the times and drops menus and footers", () => {
    const menu = Array.from({ length: 60 }, (_, i) => `Menu item ${i}`);
    const footer = Array.from({ length: 60 }, (_, i) => `Footer line ${i}`);
    const out = h.trimToTimes([...menu, "9:00 AM Yoga", "10:00 AM Flow", ...footer].join("\n"));
    expect(out).toContain("9:00 AM Yoga");
    expect(out).toContain("10:00 AM Flow");
    expect(out).not.toContain("Menu item 0");
    expect(out).not.toContain("Footer line 59");
  });
  it("returns text with no times as it is", () => {
    expect(h.trimToTimes("Welcome\nAbout us")).toBe("Welcome\nAbout us");
  });
});

describe("parseFcEvent", () => {
  it("reads a PushPress event, dropping the time its title starts with", () => {
    expect(h.parseFcEvent({ time: "8:30AM — 10:00AM", title: "8:30 AM Hyrox", coach: "Ariel Schimek" }, "2026-10-08")).toEqual({
      date: "2026-10-08",
      start: "08:30",
      end: "10:00",
      name: "Hyrox",
      instructor: "Ariel Schimek",
      spots: null,
    });
  });
  it("reads a title with no am/pm in front of it ('3:00 Conditioning')", () => {
    expect(h.parseFcEvent({ time: "3:00pm — 4:00pm", title: "3:00 Conditioning", coach: "" }, "2026-10-08")).toMatchObject({ start: "15:00", end: "16:00", name: "Conditioning", instructor: null });
  });
  it("reads a Zen Planner event that has only a start time", () => {
    expect(h.parseFcEvent({ time: "5:30am", title: "RHF CrossFit", coach: "" }, "2026-10-08")).toMatchObject({ start: "05:30", end: null, name: "RHF CrossFit" });
    expect(h.parseFcEvent({ time: "12:00pm", title: "RHF CrossFit", coach: "" }, "2026-10-08")).toMatchObject({ start: "12:00" });
  });
  it("reads a Fitli event from its full 12-hour range", () => {
    expect(h.parseFcEvent({ time: "3:00 PM - 3:50 PM", title: "Essential Reformer", coach: "Geneva" }, "2026-10-08")).toMatchObject({ start: "15:00", end: "15:50", instructor: "Geneva" });
  });
  it("gives null when there is no start time or no name, so the page goes to the model", () => {
    expect(h.parseFcEvent({ time: "", title: "Yoga", coach: "" }, "2026-10-08")).toBeNull();
    expect(h.parseFcEvent({ time: "9:00am", title: "", coach: "" }, "2026-10-08")).toBeNull();
  });
});

describe("timeOnPage and verify", () => {
  it("finds a start time written the ways studios write it", () => {
    expect(h.timeOnPage("17:30", "Class at 5:30 PM")).toBe(true);
    expect(h.timeOnPage("05:30", "5:30amRHF CrossFit(4/9)")).toBe(true);
    expect(h.timeOnPage("15:00", "3:00 - 3:50 Essential Reformer")).toBe(true);
    expect(h.timeOnPage("07:00", "no times here")).toBe(false);
  });

  it("keeps a class whose name and time are on the page, drops one that is not, and cleans a name that starts with its time", () => {
    const page = "5am CrossFit 5:00am — 6:00am Tim\n6:00 PM Yoga Flow";
    const { kept, dropped } = h.verify(
      [
        { date: "2026-10-09", start: "05:00", end: "06:00", name: "5am CrossFit", instructor: "Tim" },
        { date: "2026-10-09", start: "18:00", end: null, name: "Yoga Flow", instructor: null },
        { date: "2026-10-09", start: "20:00", end: null, name: "Invented Class", instructor: null },
      ],
      page
    );
    expect(kept.map((c: { name: string }) => c.name)).toEqual(["CrossFit", "Yoga Flow"]);
    expect(dropped.map((c: { name: string }) => c.name)).toEqual(["Invented Class"]);
  });
});
