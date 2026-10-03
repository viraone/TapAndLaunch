import { describe, expect, it } from "vitest";
import { hoursRows } from "@/lib/food/placeSheet";

const WEEK = [
  "Monday: 11 AM – 9 PM",
  "Tuesday: 11 AM – 9 PM",
  "Wednesday: 11 AM – 9 PM",
  "Thursday: 11 AM – 9 PM",
  "Friday: 11 AM – 10 PM",
  "Saturday: 11 AM – 10 PM",
  "Sunday: Closed",
];
const PDT = -420;

describe("hoursRows", () => {
  it("splits each line into day and hours", () => {
    const rows = hoursRows(WEEK, new Date("2026-10-03T20:00:00Z"), PDT);
    expect(rows[0]).toMatchObject({ day: "Monday", hours: "11 AM – 9 PM" });
    expect(rows[6]).toMatchObject({ day: "Sunday", hours: "Closed" });
  });

  it("flags today in the restaurant's own time zone (Saturday afternoon in Seattle)", () => {
    const rows = hoursRows(WEEK, new Date("2026-10-03T22:30:00Z"), PDT); // Sat Oct 3, 3:30 PM PDT
    expect(rows.filter((r) => r.today).map((r) => r.day)).toEqual(["Saturday"]);
  });

  it("uses local, not UTC, day: 8 PM Friday in Seattle is already Saturday in UTC", () => {
    const rows = hoursRows(WEEK, new Date("2026-10-03T03:00:00Z"), PDT); // Fri Oct 2, 8 PM PDT
    expect(rows.filter((r) => r.today).map((r) => r.day)).toEqual(["Friday"]);
  });

  it("flags nothing when the time zone is unknown", () => {
    expect(hoursRows(WEEK, new Date(), null).some((r) => r.today)).toBe(false);
  });
});

import { mapsPlaceUrl, safeWebsite, telHref } from "@/lib/food/placeSheet";

describe("contact links", () => {
  it("builds a tel: link from Google's international number", () => {
    expect(telHref("+1 206-555-0100")).toBe("tel:+12065550100");
    expect(telHref("+44 20 7946 0958")).toBe("tel:+442079460958");
  });
  it("gives no tel: link when the number is missing or not usable", () => {
    expect(telHref(null)).toBeNull();
    expect(telHref("206-555-0100")).toBeNull(); // no country code
    expect(telHref("call us")).toBeNull();
  });
  it("only allows http(s) websites", () => {
    expect(safeWebsite("https://phoan.example.com/menu")).toBe("https://phoan.example.com/menu");
    expect(safeWebsite("javascript:alert(1)")).toBeNull();
    expect(safeWebsite("not a url")).toBeNull();
    expect(safeWebsite(null)).toBeNull();
  });
  it("links the Maps place page by name and place id, encoded", () => {
    expect(mapsPlaceUrl("Pho & Co", "ChIJabc")).toBe("https://www.google.com/maps/search/?api=1&query=Pho%20%26%20Co&query_place_id=ChIJabc");
  });
});
