import { describe, expect, it } from "vitest";
import { addMonths, dayKey, groupByDay, monthGrid, monthLabel, monthOfKey } from "./month-grid";

const LA = "America/Los_Angeles";

function check(rows: ReturnType<typeof monthGrid>, first: string, last: string, rowCount: number, inMonth: number) {
  expect(rows).toHaveLength(rowCount);
  expect(rows[0][0].key).toBe(first);
  expect(rows[rowCount - 1][6].key).toBe(last);
  const cells = rows.flat();
  expect(cells.filter((c) => c.inMonth)).toHaveLength(inMonth);
  for (const row of rows) expect(row).toHaveLength(7);
  for (let i = 1; i < cells.length; i++) expect(cells[i].key > cells[i - 1].key).toBe(true);
  for (const c of cells) expect(c.day).toBe(Number(c.key.slice(-2)));
}

describe("monthGrid", () => {
  it("November 2026 starts on a Sunday and needs 5 rows", () => {
    const rows = monthGrid(2026, 10);
    check(rows, "2026-11-01", "2026-12-05", 5, 30);
    expect(rows[0][0].inMonth).toBe(true);
    expect(rows[4][6].inMonth).toBe(false);
  });
  it("August 2026 starts on a Saturday and needs 6 rows", () => {
    check(monthGrid(2026, 7), "2026-07-26", "2026-09-05", 6, 31);
    expect(monthGrid(2026, 7)[0][0].inMonth).toBe(false);
  });
  it("December 2026 crosses into the next year", () => {
    check(monthGrid(2026, 11), "2026-11-29", "2027-01-02", 5, 31);
  });
  it("February 2028 is a leap month", () => {
    check(monthGrid(2028, 1), "2028-01-30", "2028-03-04", 5, 29);
  });
  it("January 2027 starts on a Friday and needs 6 rows", () => {
    check(monthGrid(2027, 0), "2026-12-27", "2027-02-06", 6, 31);
  });
});

describe("addMonths / monthOfKey / monthLabel", () => {
  it("rolls the year over in both directions", () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths(2026, 10, 14)).toEqual({ year: 2028, month: 0 });
    expect(addMonths(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
  });
  it("reads a key and labels a month", () => {
    expect(monthOfKey("2026-11-28")).toEqual({ year: 2026, month: 10 });
    expect(monthLabel(2026, 10)).toBe("November 2026");
    expect(monthLabel(2028, 1)).toBe("February 2028");
  });
});

describe("dayKey", () => {
  it("uses the given zone, not UTC", () => {
    expect(dayKey("2026-11-28T03:30:00Z", LA)).toBe("2026-11-27");
    expect(dayKey("2026-11-28T03:30:00Z", "UTC")).toBe("2026-11-28");
  });
  it("respects daylight time (PDT is UTC-7)", () => {
    expect(dayKey("2026-07-04T06:59:00Z", LA)).toBe("2026-07-03");
    expect(dayKey("2026-07-04T07:00:00Z", LA)).toBe("2026-07-04");
  });
  it("takes a Date, rejects garbage, and falls back on an unknown zone", () => {
    expect(dayKey(new Date("2026-11-28T03:30:00Z"), "UTC")).toBe("2026-11-28");
    expect(dayKey("not a date", "UTC")).toBeNull();
    expect(dayKey("2026-11-28T03:30:00Z", "Mars/Base")).toBe("2026-11-27");
  });
});

describe("groupByDay", () => {
  it("groups by Los Angeles day, keeps order, skips invalid dates", () => {
    const events = [
      { id: 1, starts_at: "2026-11-28T03:30:00Z" },
      { id: 2, starts_at: "2026-11-27T20:00:00Z" },
      { id: 3, starts_at: "2026-11-29T02:00:00Z" },
      { id: 4, starts_at: "nope" },
    ];
    const grouped = groupByDay(events, LA);
    expect(Object.keys(grouped).sort()).toEqual(["2026-11-27", "2026-11-28"]);
    expect(grouped["2026-11-27"].map((e) => e.id)).toEqual([1, 2]);
    expect(grouped["2026-11-28"].map((e) => e.id)).toEqual([3]);
    expect(groupByDay([], LA)).toEqual({});
  });
});
