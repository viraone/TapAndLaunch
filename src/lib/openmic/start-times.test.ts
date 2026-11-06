import { describe, expect, it } from "vitest";
import type { LineupEntry } from "@/lib/openmic/selection";
import type { Spotlight } from "./spotlight";
import { estimateStartTimes, parseSetAt, setMinutes } from "./start-times";

const lineup: LineupEntry[] = [
  { name: "Nick Cody", set_length: "5 min", start_time: "7:00 PM" },
  { name: "Katie Hildebrand", set_length: "3 min", start_time: "7:05 PM" },
  { name: "Masih Ahmad", set_length: "3 min", start_time: "7:08 PM" },
  { name: "Phil Ganz", set_length: "3 min", start_time: "7:11 PM" },
  { name: "Ali Brenes", set_length: "3 min", start_time: "7:14 PM" },
];

const timeZone = "America/Los_Angeles";
const showDate = "2026-11-06";
const sheetLabels = (rows: LineupEntry[] = lineup) => rows.map((entry) => ({ text: entry.start_time, estimated: false }));

function spotlightAt(position: number | null, name: string, setAt: string, date: string | null = showDate): Spotlight {
  return { show_date: date, position, name, set_at: setAt, set_by: "Viradeth" };
}

function labels(spotlight: Spotlight | null, now: string, rows: LineupEntry[] = lineup) {
  return estimateStartTimes({ lineup: rows, spotlight, showDate, timeZone, now: new Date(now) });
}

describe("estimateStartTimes", () => {
  it("estimates from the spotlight: the row before it is on stage, the row itself is on deck", () => {
    // 7:05:30 PM PST: Masih's highlight moved as Katie walked on.
    const result = labels(spotlightAt(2, "Masih Ahmad", "2026-11-07T03:05:30Z"), "2026-11-07T03:06:00Z");
    expect(result).toEqual([
      { text: "7:00 PM", estimated: false },
      { text: "7:05 PM", estimated: false },
      { text: "~7:09 PM", estimated: true },
      { text: "~7:13 PM", estimated: true },
      { text: "~7:17 PM", estimated: true },
    ]);
  });

  it("pulls the on-deck estimate to now when the comic on stage overruns", () => {
    // 7:20 PM PST: Katie started at 7:05 and is 15 minutes over.
    const result = labels(spotlightAt(2, "Masih Ahmad", "2026-11-07T03:05:30Z"), "2026-11-07T03:20:00Z");
    expect(result.slice(2)).toEqual([
      { text: "~7:20 PM", estimated: true },
      { text: "~7:24 PM", estimated: true },
      { text: "~7:28 PM", estimated: true },
    ]);
  });

  it("works with the highlight on the last row", () => {
    const result = labels(spotlightAt(4, "Ali Brenes", "2026-11-07T03:05:30Z"), "2026-11-07T03:06:00Z");
    expect(result).toEqual([
      { text: "7:00 PM", estimated: false },
      { text: "7:05 PM", estimated: false },
      { text: "7:08 PM", estimated: false },
      { text: "7:05 PM", estimated: false },
      { text: "~7:09 PM", estimated: true },
    ]);
  });

  it("shows the sheet times when there is no usable spotlight", () => {
    const sheet = sheetLabels();
    expect(labels(null, "2026-11-07T03:20:00Z")).toEqual(sheet);
    expect(labels(spotlightAt(null, "", "2026-11-07T03:05:30Z"), "2026-11-07T03:20:00Z")).toEqual(sheet);
    expect(labels(spotlightAt(2, "Masih Ahmad", "2026-11-07T03:05:30Z", "2026-10-30"), "2026-11-07T03:20:00Z")).toEqual(sheet);
    expect(labels(spotlightAt(2, "Masih Ahmad", "not a date"), "2026-11-07T03:20:00Z")).toEqual(sheet);
  });

  it("leaves the sheet alone when nobody is on stage and the first set has not started", () => {
    const spotlight = spotlightAt(0, "Nick Cody", "2026-11-07T02:55:00Z");
    expect(labels(spotlight, "2026-11-07T02:55:00Z")).toEqual(sheetLabels());
    // Exactly at 7:00 PM still counts as not later.
    expect(labels(spotlight, "2026-11-07T03:00:00Z")).toEqual(sheetLabels());
  });

  it("leaves the sheet alone when row 0's start time cannot be parsed", () => {
    const rows = [{ ...lineup[0]!, start_time: "" }, ...lineup.slice(1)];
    expect(labels(spotlightAt(0, "Nick Cody", "2026-11-07T03:04:00Z"), "2026-11-07T03:04:00Z", rows)).toEqual(sheetLabels(rows));
  });

  it("starts the show at now once the sheet start has passed", () => {
    // 7:04 PM PST: Nick is late. 7:04 + 5 min + 45 s = 7:09:45, which rounds to 7:10.
    const result = labels(spotlightAt(0, "Nick Cody", "2026-11-07T03:04:00Z"), "2026-11-07T03:04:00Z");
    expect(result).toEqual([
      { text: "~7:04 PM", estimated: true },
      { text: "~7:10 PM", estimated: true },
      { text: "~7:14 PM", estimated: true },
      { text: "~7:17 PM", estimated: true },
      { text: "~7:21 PM", estimated: true },
    ]);
  });

  it("keeps an empty sheet time as an empty label before the on-stage row", () => {
    const rows = [{ ...lineup[0]!, start_time: "" }, ...lineup.slice(1)];
    const result = labels(spotlightAt(3, "Phil Ganz", "2026-11-07T03:05:30Z"), "2026-11-07T03:06:00Z", rows);
    expect(result[0]).toEqual({ text: "", estimated: false });
  });

  it("reads a set_at without a zone designator as UTC", () => {
    const withZ = labels(spotlightAt(2, "Masih Ahmad", "2026-11-07T03:05:30Z"), "2026-11-07T03:06:00Z");
    const withoutZ = labels(spotlightAt(2, "Masih Ahmad", "2026-11-07T03:05:30"), "2026-11-07T03:06:00Z");
    expect(withoutZ).toEqual(withZ);
  });

  it("ignores a highlight more than 2 minutes in the future", () => {
    expect(labels(spotlightAt(2, "Masih Ahmad", "2026-11-07T03:11:00Z"), "2026-11-07T03:06:00Z")).toEqual(sheetLabels());
  });

  it("ignores a highlight more than 3 hours old", () => {
    expect(labels(spotlightAt(2, "Masih Ahmad", "2026-11-06T23:06:00Z"), "2026-11-07T03:06:00Z")).toEqual(sheetLabels());
  });

  it("still estimates from a highlight 2 h 50 min old, with the next row clamped to now", () => {
    const result = labels(spotlightAt(2, "Masih Ahmad", "2026-11-07T00:16:00Z"), "2026-11-07T03:06:00Z");
    expect(result[0]).toEqual({ text: "7:00 PM", estimated: false });
    expect(result[1]).toEqual({ text: "4:16 PM", estimated: false });
    expect(result.slice(2)).toEqual([
      { text: "~7:06 PM", estimated: true },
      { text: "~7:10 PM", estimated: true },
      { text: "~7:14 PM", estimated: true },
    ]);
  });

  it("still estimates from a highlight 90 seconds in the future", () => {
    const result = labels(spotlightAt(2, "Masih Ahmad", "2026-11-07T03:07:30Z"), "2026-11-07T03:06:00Z");
    expect(result[1]).toEqual({ text: "7:07 PM", estimated: false });
    expect(result.slice(2)).toEqual([
      { text: "~7:11 PM", estimated: true },
      { text: "~7:15 PM", estimated: true },
      { text: "~7:19 PM", estimated: true },
    ]);
  });
});

describe("parseSetAt", () => {
  it("reads a Postgres timestamp without a zone designator as UTC", () => {
    const utc = Date.parse("2026-11-07T03:05:30Z");
    expect(parseSetAt("2026-11-07T03:05:30Z")).toBe(utc);
    expect(parseSetAt("2026-11-07T03:05:30")).toBe(utc);
    expect(parseSetAt("2026-11-07T03:05:30+00:00")).toBe(utc);
    expect(parseSetAt("2026-11-07 03:05:30")).toBe(utc);
  });

  it("returns NaN for garbage", () => {
    expect(parseSetAt("garbage")).toBeNaN();
  });
});

describe("setMinutes", () => {
  it("reads the first whole number and falls back to 3", () => {
    expect(setMinutes("5 min")).toBe(5);
    expect(setMinutes("7")).toBe(7);
    expect(setMinutes("3 minutes")).toBe(3);
    expect(setMinutes("")).toBe(3);
    expect(setMinutes("TBD")).toBe(3);
    expect(setMinutes("0")).toBe(3);
  });
});
