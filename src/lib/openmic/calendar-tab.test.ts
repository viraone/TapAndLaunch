import { describe, expect, it } from "vitest";
import { hidesCalendarTab } from "./calendar-tab";

describe("hidesCalendarTab", () => {
  it("is true for each of the three host emails", () => {
    expect(hidesCalendarTab("vxayananh@gmail.com")).toBe(true);
    expect(hidesCalendarTab("nickrcody@gmail.com")).toBe(true);
    expect(hidesCalendarTab("dinodadcomedy@gmail.com")).toBe(true);
  });

  it("ignores case and surrounding spaces", () => {
    expect(hidesCalendarTab("  NickRCody@Gmail.com ")).toBe(true);
  });

  it("is false for other emails and missing values", () => {
    expect(hidesCalendarTab("someone@example.com")).toBe(false);
    expect(hidesCalendarTab("therickshawhaha@gmail.com")).toBe(false);
    expect(hidesCalendarTab("")).toBe(false);
    expect(hidesCalendarTab(null)).toBe(false);
    expect(hidesCalendarTab(undefined)).toBe(false);
  });
});
