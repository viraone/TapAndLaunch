import { describe, expect, it } from "vitest";
import { CELL_TTL_MS, isCellFresh } from "./cellFreshness";

const now = Date.parse("2026-10-06T12:00:00Z");

describe("isCellFresh", () => {
  it("trusts an area fetched within the week, after websites were being saved", () => {
    expect(isCellFresh("2026-10-05T12:00:00Z", now)).toBe(true);
    const later = Date.parse("2026-10-20T12:00:00Z");
    expect(isCellFresh(new Date(later - CELL_TTL_MS + 60_000).toISOString(), later)).toBe(true);
    expect(isCellFresh(new Date(later - CELL_TTL_MS - 60_000).toISOString(), later)).toBe(false);
  });
  it("refetches an area older than a week", () => {
    expect(isCellFresh("2026-09-30T12:00:00Z", now + CELL_TTL_MS)).toBe(false);
  });
  it("refetches an area saved before websites were stored, even if it is less than a week old", () => {
    expect(isCellFresh("2026-10-03T20:00:00Z", now)).toBe(false);
    expect(isCellFresh("2026-10-01T02:00:00Z", Date.parse("2026-10-04T01:00:00Z"))).toBe(false);
  });
});
