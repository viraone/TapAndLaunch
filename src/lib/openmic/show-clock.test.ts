import { describe, expect, it } from "vitest";
import { clockProgress, finishedLabel, finishedRecord, firstComicIndex, showClock } from "./show-clock";
import type { LineupEntry } from "@/lib/openmic/selection";
import type { Spotlight } from "@/lib/openmic/spotlight";

function entry(name: string, set_length: string): LineupEntry {
  return { name, set_length, start_time: "", mine: false };
}

const lineup = [entry("Viradeth", "5 min"), entry("Karen Young", "3 min"), entry("Evan Hales", "3 min"), entry("Jason Katz", "3 min")];
const showDate = "2026-11-13";
const running: Spotlight = { show_date: showDate, position: 1, name: "Karen Young", set_at: "2026-11-14T03:00:00.000Z", set_by: "Viradeth", stopped_at: null, sets: [] };

describe("firstComicIndex", () => {
  it("skips the host's own opening row", () => {
    expect(firstComicIndex(lineup, "Viradeth")).toBe(1);
    expect(firstComicIndex(lineup, "Viradeth Chan")).toBe(1);
  });
  it("starts at row 0 when the host is not on the list", () => {
    expect(firstComicIndex(lineup, "Nick")).toBe(0);
    expect(firstComicIndex(lineup, null)).toBe(0);
  });
  it("handles an empty lineup and a host alone", () => {
    expect(firstComicIndex([], "Viradeth")).toBe(-1);
    expect(firstComicIndex([entry("Viradeth", "5 min")], "Viradeth")).toBe(0);
  });
});

describe("showClock", () => {
  it("is idle before START", () => {
    expect(showClock({ lineup, spotlight: null, showDate, hostName: "Viradeth", now: new Date("2026-11-14T02:30:00.000Z") })).toEqual({ kind: "idle", nextIndex: 1, nextMs: 180000 });
  });
  it("is idle before START when the host is not on the list", () => {
    expect(showClock({ lineup, spotlight: null, showDate, hostName: "Nick", now: new Date("2026-11-14T02:30:00.000Z") })).toEqual({ kind: "idle", nextIndex: 0, nextMs: 300000 });
  });
  it("is running for Karen", () => {
    expect(showClock({ lineup, spotlight: running, showDate, hostName: "Viradeth", now: new Date("2026-11-14T03:01:00.000Z") })).toEqual({ kind: "running", index: 1, remainingMs: 120000, totalMs: 180000, onDeckIndex: 2 });
  });
  it("is running past the set length", () => {
    expect(showClock({ lineup, spotlight: running, showDate, hostName: "Viradeth", now: new Date("2026-11-14T03:03:15.000Z") })).toEqual({ kind: "running", index: 1, remainingMs: -15000, totalMs: 180000, onDeckIndex: 2 });
  });
  it("is idle after STOP with Evan next", () => {
    expect(showClock({ lineup, spotlight: { ...running, stopped_at: "2026-11-14T03:03:40.000Z" }, showDate, hostName: "Viradeth", now: new Date("2026-11-14T03:04:00.000Z") })).toEqual({ kind: "idle", nextIndex: 2, nextMs: 180000 });
  });
  it("has nobody on deck for the last comic", () => {
    expect(showClock({ lineup, spotlight: { ...running, position: 3, name: "Jason Katz" }, showDate, hostName: "Viradeth", now: new Date("2026-11-14T03:01:00.000Z") })).toEqual({ kind: "running", index: 3, remainingMs: 120000, totalMs: 180000, onDeckIndex: -1 });
  });
  it("is over after the last comic stops", () => {
    expect(showClock({ lineup, spotlight: { ...running, position: 3, name: "Jason Katz", stopped_at: "2026-11-14T03:03:00.000Z" }, showDate, hostName: "Viradeth", now: new Date("2026-11-14T03:04:00.000Z") })).toEqual({ kind: "idle", nextIndex: -1, nextMs: 0 });
  });
  it("ignores a stale clock", () => {
    expect(showClock({ lineup, spotlight: running, showDate, hostName: "Viradeth", now: new Date("2026-11-14T07:30:00.000Z") })).toEqual({ kind: "idle", nextIndex: 1, nextMs: 180000 });
  });
  it("ignores a clock from another show day", () => {
    expect(showClock({ lineup, spotlight: { ...running, show_date: "2026-11-06" }, showDate, hostName: "Viradeth", now: new Date("2026-11-14T03:01:00.000Z") })).toEqual({ kind: "idle", nextIndex: 1, nextMs: 180000 });
  });
});

describe("finishedRecord", () => {
  const sets = [{ position: 1, name: "Karen Young", started_at: "2026-11-14T03:00:00.000Z", stopped_at: "2026-11-14T03:03:40.000Z" }];
  it("finds by position and name", () => {
    expect(finishedRecord(sets, 1, "Karen Young")).toBe(sets[0]);
  });
  it("finds by name alone when the row moved", () => {
    expect(finishedRecord(sets, 2, "Karen Young")).toBe(sets[0]);
  });
  it("returns undefined when nothing matches", () => {
    expect(finishedRecord(sets, 2, "Evan Hales")).toBeUndefined();
    expect(finishedRecord(undefined, 1, "Karen Young")).toBeUndefined();
  });
});

describe("finishedLabel", () => {
  const record = { position: 1, name: "Karen Young", started_at: "2026-11-14T03:00:00.000Z", stopped_at: "2026-11-14T03:03:40.000Z" };
  it("shows over time with a plus", () => {
    expect(finishedLabel(record, "3 min")).toBe("+0:40");
  });
  it("shows the time on stage when under the limit", () => {
    expect(finishedLabel({ ...record, stopped_at: "2026-11-14T03:02:50.000Z" }, "3 min")).toBe("2:50");
  });
  it("shows the exact set length", () => {
    expect(finishedLabel({ ...record, stopped_at: "2026-11-14T03:03:00.000Z" }, "3 min")).toBe("3:00");
  });
  it("returns null for no record or a bad one", () => {
    expect(finishedLabel(undefined, "3 min")).toBeNull();
    expect(finishedLabel({ ...record, stopped_at: "2026-11-14T02:59:00.000Z" }, "3 min")).toBeNull();
  });
});

describe("clockProgress", () => {
  it("is undefined when nothing runs", () => {
    expect(clockProgress({ kind: "idle", nextIndex: 1, nextMs: 180000 })).toBeUndefined();
  });
  it("starts at 0 and grows with the set", () => {
    expect(clockProgress({ kind: "running", index: 1, remainingMs: 180000, totalMs: 180000, onDeckIndex: 2 })).toBe(0);
    expect(clockProgress({ kind: "running", index: 1, remainingMs: 120000, totalMs: 180000, onDeckIndex: 2 })).toBeCloseTo(33.33, 2);
  });
  it("stops at 100 once over time", () => {
    expect(clockProgress({ kind: "running", index: 1, remainingMs: -15000, totalMs: 180000, onDeckIndex: 2 })).toBe(100);
  });
});
