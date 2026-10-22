import { describe, expect, it } from "vitest";
import { spotlightIndex, ymd, type Spotlight } from "./spotlight";

const lineup = [
  { name: "Viradeth", set_length: "5 min", start_time: "7:00 PM" },
  { name: "Rich Snyder", set_length: "3 min", start_time: "7:05 PM" },
  { name: "Danny Anderson", set_length: "3 min", start_time: "7:08 PM" },
];
const at = (position: number | null, name: string, show_date: string | null = "2026-10-23"): Spotlight => ({
  show_date,
  position,
  name,
  set_at: "2026-10-23T02:30:00Z",
  set_by: "Viradeth",
});

describe("spotlightIndex", () => {
  it("is the position when the name there still matches", () => {
    expect(spotlightIndex(at(1, "Rich Snyder"), lineup, "2026-10-23")).toBe(1);
  });
  it("follows the name when the host moved rows in the sheet", () => {
    expect(spotlightIndex(at(0, "Danny Anderson"), lineup, "2026-10-23")).toBe(2);
  });
  it("is nobody when cleared, for another show, never set, or the comic left the lineup", () => {
    expect(spotlightIndex(at(null, ""), lineup, "2026-10-23")).toBe(-1);
    expect(spotlightIndex(at(1, "Rich Snyder", "2026-10-16"), lineup, "2026-10-23")).toBe(-1);
    expect(spotlightIndex(at(1, "Rich Snyder", null), lineup, "2026-10-23")).toBe(-1);
    expect(spotlightIndex(null, lineup, "2026-10-23")).toBe(-1);
    expect(spotlightIndex(at(1, "Someone Gone"), lineup, "2026-10-23")).toBe(-1);
    expect(spotlightIndex(at(9, "Rich Snyder"), lineup, "2026-10-23")).toBe(1);
  });
});

describe("ymd", () => {
  it("pads the month and day", () => {
    expect(ymd({ year: 2026, month: 1, day: 9 })).toBe("2026-01-09");
    expect(ymd({ year: 2026, month: 10, day: 23 })).toBe("2026-10-23");
  });
});
