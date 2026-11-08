import { describe, expect, it } from "vitest";
import { formatCountdown, tvTimer } from "./tv-timer";
import type { LineupEntry } from "@/lib/openmic/selection";

function entry(name: string, set_length: string): LineupEntry {
  return { name, set_length, start_time: "" };
}

describe("formatCountdown", () => {
  it("formats milliseconds as M:SS", () => {
    expect(formatCountdown(300000)).toBe("5:00");
    expect(formatCountdown(7000)).toBe("0:07");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(59999)).toBe("1:00");
    expect(formatCountdown(-15000)).toBe("+0:15");
  });
});

describe("tvTimer", () => {
  const lineup = [entry("Viradeth", "5 min"), entry("Karen Young", "3 min"), entry("Evan Hales", "3 min")];
  const labels = [{ text: "7:00 PM", estimated: false }, { text: "7:05 PM", estimated: true }, { text: "7:09 PM", estimated: true }];
  const showDate = "2026-11-13";
  const setAt = "2026-11-14T03:00:00.000Z";
  const spot = { show_date: showDate, position: 1, name: "Karen Young", set_at: setAt, set_by: "host" };

  it("Karen on deck means Viradeth is on stage", () => {
    expect(tvTimer({ lineup, spotlight: spot, showDate, startLabels: labels, now: new Date("2026-11-14T03:02:00.000Z") })).toEqual({
      kind: "on",
      name: "Viradeth",
      remainingMs: 180000,
      totalMs: 300000,
      nextName: "Karen Young",
      nextAt: "7:05 PM",
    });
  });

  it("over time goes negative", () => {
    expect(tvTimer({ lineup, spotlight: spot, showDate, startLabels: labels, now: new Date("2026-11-14T03:05:15.000Z") })).toEqual({
      kind: "on",
      name: "Viradeth",
      remainingMs: -15000,
      totalMs: 300000,
      nextName: "Karen Young",
      nextAt: "7:05 PM",
    });
  });

  it("no spotlight: first comic is next", () => {
    expect(tvTimer({ lineup, spotlight: null, showDate, startLabels: labels, now: new Date("2026-11-14T02:30:00.000Z") })).toEqual({
      kind: "idle",
      nextName: "Viradeth",
      nextAt: "7:00 PM",
    });
  });

  it("first comic on deck: nobody on stage yet", () => {
    expect(tvTimer({ lineup, spotlight: { ...spot, position: 0, name: "Viradeth" }, showDate, startLabels: labels, now: new Date("2026-11-14T02:59:00.000Z") })).toEqual({
      kind: "idle",
      nextName: "Viradeth",
      nextAt: "7:00 PM",
    });
  });

  it("a stale spotlight is ignored", () => {
    const result = tvTimer({ lineup, spotlight: spot, showDate, startLabels: labels, now: new Date("2026-11-14T07:30:00.000Z") });
    expect(result.kind).toBe("idle");
  });
});

