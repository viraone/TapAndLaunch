import { describe, expect, it } from "vitest";
// The job lives outside src (it runs on the owner's Mac); its pure helpers are tested here.
import { NEIGHBORHOODS, cellKey, pointNeedsSeeding, seedPoints } from "../../../tools/menu-ingest/neighborhoods.mjs";
import { composeReport, orderQueue, queueTier } from "../../../tools/menu-ingest/lib.mjs";
import { readFileSync } from "node:fs";

describe("neighborhood coverage map", () => {
  it("lists real Seattle points, one search per grid cell", () => {
    expect(NEIGHBORHOODS.length).toBeGreaterThan(40);
    const points = seedPoints();
    expect(new Set(points.map((p: { cell: string }) => p.cell)).size).toBe(points.length);
    for (const p of points as Array<{ lat: number; lng: number }>) {
      expect(p.lat).toBeGreaterThan(47.48);
      expect(p.lat).toBeLessThan(47.74);
      expect(p.lng).toBeGreaterThan(-122.44);
      expect(p.lng).toBeLessThan(-122.24);
    }
  });
  it("uses the same grid cells as the app", () => {
    // nearby.ts is server-only, so check its grid definition in the source instead of importing it.
    const app = readFileSync("src/lib/food/nearby.ts", "utf8");
    expect(app).toContain("const CELL_SIZE_DEG = 0.015;");
    expect(app).toContain("Math.floor(latitude / CELL_SIZE_DEG)");
    expect(app).toContain("Math.floor(longitude / CELL_SIZE_DEG)");
    expect(cellKey(47.6205, -122.3212)).toBe(`${Math.floor(47.6205 / 0.015)}:${Math.floor(-122.3212 / 0.015)}`);
  });
  it("skips a point only while both searches are recent", () => {
    const now = Date.UTC(2026, 9, 5);
    const day = (n: number) => new Date(now - n * 86400000).toISOString();
    expect(pointNeedsSeeding([], ["all", "bars"], 60, now)).toBe(true);
    expect(pointNeedsSeeding([{ fetch_group: "all", fetched_at: day(3) }], ["all", "bars"], 60, now)).toBe(true);
    expect(pointNeedsSeeding([{ fetch_group: "all", fetched_at: day(3) }, { fetch_group: "bars", fetched_at: day(10) }], ["all", "bars"], 60, now)).toBe(false);
    expect(pointNeedsSeeding([{ fetch_group: "all", fetched_at: day(90) }, { fetch_group: "bars", fetched_at: day(10) }], ["all", "bars"], 60, now)).toBe(true);
  });
});

describe("daily queue", () => {
  it("puts bars first and marks chains as low value", () => {
    expect(queueTier({ name: "The Bait Shop", primary_type: "bar", types: [] })).toEqual({ lowValue: false, tier: 0 });
    expect(queueTier({ name: "Fiddler's Inn Pub & Pizza", primary_type: "pizza_restaurant", types: [] }).tier).toBe(0);
    expect(queueTier({ name: "Taco Bell", primary_type: "mexican_restaurant", types: [] })).toEqual({ lowValue: true, tier: 2 });
    expect(queueTier({ name: "Local Bakery", primary_type: "bakery", types: [] }).lowValue).toBe(true);
    expect(queueTier({ name: "Pho An", primary_type: "vietnamese_restaurant", types: [] })).toEqual({ lowValue: false, tier: 1 });
  });
  it("orders never-checked first, then oldest, bars before restaurants, and can drop chains", () => {
    const rows = [
      { name: "Pho An", primary_type: "restaurant", types: [], rating_count: 900, happy_hour_at: null },
      { name: "Dive Bar", primary_type: "bar", types: [], rating_count: 50, happy_hour_at: null },
      { name: "Old Check Pub", primary_type: "pub", types: [], rating_count: 5000, happy_hour_at: "2026-08-01T00:00:00Z" },
      { name: "Taco Bell", primary_type: "fast_food_restaurant", types: [], rating_count: 3000, happy_hour_at: null },
      { name: "Recent Check Bar", primary_type: "bar", types: [], rating_count: 100, happy_hour_at: "2026-09-20T00:00:00Z" },
    ];
    expect(orderQueue(rows).map((r: { name: string }) => r.name)).toEqual(["Dive Bar", "Pho An", "Taco Bell", "Old Check Pub", "Recent Check Bar"]);
    expect(orderQueue(rows, { happyOnly: true }).map((r: { name: string }) => r.name)).toEqual(["Dive Bar", "Pho An", "Old Check Pub", "Recent Check Bar"]);
  });
});

describe("composeReport", () => {
  it("summarizes a run for a phone notification", () => {
    const r = composeReport(
      {
        seed: { pointsDone: 8, callsUsed: 41, stopped: "limit" },
        happy: { read: 120, tally: { happy_ok: 9, happy_none: 100, happy_unclear: 5, error: 2 }, foundHappyHours: ["A", "B", "C", "D"] },
      },
      { withHappyHour: 31, neverChecked: 250 }
    );
    expect(r.title).toBe("LiveBites: 4 happy hours found");
    expect(r.body).toContain("A, B, C +1 more");
    expect(r.body).toContain("8 areas added, 41 Google calls");
    expect(r.body).toContain("Read 120 places");
    expect(r.body).toContain("31 places have a happy hour now, 250 not checked yet");
    expect(r.body.length).toBeLessThanOrEqual(390);
  });
  it("is calm when nothing was found", () => {
    expect(composeReport({ happy: { read: 10, tally: {}, foundHappyHours: [] } }).title).toBe("LiveBites job finished");
    expect(composeReport({}).body).toContain("nothing to report");
  });
});
