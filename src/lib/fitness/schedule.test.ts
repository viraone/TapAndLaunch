import { describe, expect, it } from "vitest";
import { areaForLabel, areasFromStudios, classMinutes, milesBetween, firstDayWithClasses, hasStarted, nextDays, partOfDay, seattleStamp, seattleToday, time12 } from "@/lib/fitness/schedule";

describe("FitnessNav schedule helpers", () => {
  it("tells Seattle time, not the server's", () => {
    // 05:30 UTC on Oct 5 is still Sunday evening Oct 4 in Seattle (PDT, UTC-7).
    expect(seattleStamp(new Date("2026-10-05T05:30:00Z"))).toBe("2026-10-04 22:30");
    expect(seattleToday(new Date("2026-10-05T05:30:00Z"))).toBe("2026-10-04");
  });
  it("lists a week of days across a month end", () => {
    expect(nextDays("2026-10-29", 5)).toEqual(["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(nextDays("2026-10-04")).toHaveLength(7);
  });
  it("knows which classes already started", () => {
    expect(hasStarted({ date: "2026-10-04", start: "17:30" }, "2026-10-04 21:15")).toBe(true);
    expect(hasStarted({ date: "2026-10-05", start: "06:15" }, "2026-10-04 21:15")).toBe(false);
  });
  it("groups by part of day and formats times", () => {
    expect([partOfDay("06:15"), partOfDay("12:00"), partOfDay("16:59"), partOfDay("17:00")]).toEqual(["Morning", "Afternoon", "Afternoon", "Evening"]);
    expect([time12("06:15"), time12("12:00"), time12("00:30"), time12("19:30")]).toEqual(["6:15 AM", "12:00 PM", "12:30 AM", "7:30 PM"]);
    expect([classMinutes("06:15", "07:15"), classMinutes("09:00", null), classMinutes("10:00", "09:00")]).toEqual([60, null, null]);
  });
  it("measures miles", () => {
    // Maven (Fremont) to Sealevel Hot Yoga is about a quarter mile.
    expect(milesBetween(47.651, -122.3505, 47.6518, -122.3549)).toBeCloseTo(0.21, 1);
  });
  it("opens on the first day that still has a class to book", () => {
    const days = nextDays("2026-10-04", 3);
    expect(firstDayWithClasses(days, [{ date: "2026-10-04", start: "17:30" }, { date: "2026-10-05", start: "06:15" }], "2026-10-04 21:15")).toBe("2026-10-05");
    expect(firstDayWithClasses(days, [], "2026-10-04 21:15")).toBe("2026-10-04");
  });
});

describe("areasFromStudios", () => {
  it("centres each neighborhood on its studios, counts them, sorts A to Z, and skips studios without a place", () => {
    const areas = areasFromStudios([
      { neighborhood: "Fremont", latitude: 47.65, longitude: -122.35 },
      { neighborhood: "Fremont", latitude: 47.67, longitude: -122.37 },
      { neighborhood: "Ballard", latitude: 47.68, longitude: -122.38 },
      { neighborhood: "Capitol Hill", latitude: null, longitude: null },
      { neighborhood: null, latitude: 47.6, longitude: -122.3 },
    ]);
    expect(areas.map((a) => ({ ...a, lat: +a.lat.toFixed(3), lng: +a.lng.toFixed(3) }))).toEqual([
      { name: "Ballard", lat: 47.68, lng: -122.38, n: 1 },
      { name: "Fremont", lat: 47.66, lng: -122.36, n: 2 },
    ]);
  });
});

describe("areaForLabel", () => {
  const areas = [{ name: "Ballard" }, { name: "Capitol" }, { name: "Capitol Hill" }, { name: "Fremont" }];
  it("finds the neighborhood an app's label starts with", () => {
    expect(areaForLabel(areas, "Fremont, Seattle")).toBe("Fremont");
    expect(areaForLabel(areas, "fremont")).toBe("Fremont");
  });
  it("prefers the longest matching name", () => {
    expect(areaForLabel(areas, "Capitol Hill, Seattle")).toBe("Capitol Hill");
  });
  it("gives null for a label no neighborhood starts, or no label", () => {
    expect(areaForLabel(areas, "Downtown Seattle")).toBeNull();
    expect(areaForLabel(areas, "")).toBeNull();
    expect(areaForLabel(areas, null)).toBeNull();
  });
});
