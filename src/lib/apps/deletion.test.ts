import { describe, expect, it } from "vitest";
import { APP_RESTORE_DAYS, confirmationMatches, describeLosses, restoreDaysLeft } from "./deletion";

const now = new Date("2026-10-05T12:00:00Z");

describe("restoreDaysLeft", () => {
  it("counts the days left of the window, rounding up", () => {
    expect(APP_RESTORE_DAYS).toBe(30);
    expect(restoreDaysLeft("2026-10-05T11:00:00Z", now)).toBe(30);
    expect(restoreDaysLeft("2026-09-25T12:00:00Z", now)).toBe(20);
    expect(restoreDaysLeft("2026-09-05T13:00:00Z", now)).toBe(1);
  });
  it("is zero once the window has passed", () => {
    expect(restoreDaysLeft("2026-09-05T12:00:00Z", now)).toBe(0);
    expect(restoreDaysLeft("2026-08-01T00:00:00Z", now)).toBe(0);
  });
});

describe("confirmationMatches", () => {
  it("needs the exact name, forgiving only outer spaces", () => {
    expect(confirmationMatches("Gym Hub", "Gym Hub")).toBe(true);
    expect(confirmationMatches("  Gym Hub ", "Gym Hub")).toBe(true);
    expect(confirmationMatches("gym hub", "Gym Hub")).toBe(false);
    expect(confirmationMatches("Gym", "Gym Hub")).toBe(false);
    expect(confirmationMatches("", "")).toBe(false);
    expect(confirmationMatches(undefined, "Gym Hub")).toBe(false);
  });
});

describe("describeLosses", () => {
  it("lists only what exists, with proper plurals", () => {
    expect(describeLosses({ members: 1, orders: 2, submissions: 0, bookings: 0, subscribers: 1200, products: 0 })).toEqual([
      "1 member",
      "2 orders",
      "1,200 notification subscribers",
    ]);
    expect(describeLosses({ members: 0, orders: 0, submissions: 0, bookings: 0, subscribers: 0, products: 0 })).toEqual([]);
  });
});
