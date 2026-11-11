import { describe, expect, it } from "vitest";
import { tonightHeading } from "./tonight";

const SHOW = { year: 2026, month: 11, day: 13 };
const TZ = "America/Los_Angeles";
const at = (iso: string) => tonightHeading(SHOW, TZ, new Date(iso));

describe("tonightHeading", () => {
  it("says Next show on any other day", () => {
    expect(at("2026-11-12T20:00:00Z")).toEqual({ label: "Next show", startsIn: null });
  });

  it("says Tonight with hours and minutes on the show day", () => {
    expect(at("2026-11-14T00:50:00Z")).toEqual({ label: "Tonight", startsIn: "Starts in 2h 10m" });
    expect(at("2026-11-13T08:30:00Z")).toEqual({ label: "Tonight", startsIn: "Starts in 18h 30m" });
  });

  it("drops the part that is zero and rounds a part minute up", () => {
    expect(at("2026-11-14T02:00:00Z").startsIn).toBe("Starts in 1h");
    expect(at("2026-11-14T02:15:30Z").startsIn).toBe("Starts in 45m");
  });

  it("has no countdown once the show has started", () => {
    expect(at("2026-11-14T03:00:00Z")).toEqual({ label: "Tonight", startsIn: null });
    expect(at("2026-11-14T04:00:00Z")).toEqual({ label: "Tonight", startsIn: null });
  });

  it("is Next show again when the date shown is next week's", () => {
    expect(tonightHeading({ year: 2026, month: 11, day: 20 }, TZ, new Date("2026-11-14T06:00:00Z"))).toEqual({ label: "Next show", startsIn: null });
  });
});
