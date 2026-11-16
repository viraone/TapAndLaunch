import { describe, expect, it } from "vitest";
import type { ShowClock } from "@/lib/openmic/show-clock";
import { showStatusLine } from "./show-status";

const lineup = [
  { name: "Viradeth", set_length: "5 min", start_time: "7:00 PM" },
  { name: "Evan", set_length: "5 min", start_time: "7:05 PM" },
  { name: "Doug", set_length: "5 min", start_time: "7:10 PM" },
];
const running = (index: number, remainingMs: number, onDeckIndex: number): ShowClock => ({ kind: "running", index, remainingMs, totalMs: 300000, onDeckIndex });
const idle = (nextIndex: number): ShowClock => ({ kind: "idle", nextIndex, nextMs: 0 });

describe("showStatusLine", () => {
  it("running with someone on deck", () => {
    expect(showStatusLine(running(1, 90000, 2), lineup, false)).toBe("Evan is on stage now, about 2 min left. Doug is on deck.");
  });
  it("running the last comic", () => {
    expect(showStatusLine(running(2, 30000, -1), lineup, false)).toBe("Doug is on stage now, about 1 min left. Nobody is after them.");
  });
  it("running over time", () => {
    expect(showStatusLine(running(1, -61000, 2), lineup, false)).toBe("Evan is on stage now and is 2 min over time. Doug is on deck.");
  });
  it("idle with a next comic", () => {
    expect(showStatusLine(idle(1), lineup, false)).toBe("Nobody is on stage right now. Evan is on deck.");
  });
  it("show over", () => {
    expect(showStatusLine(idle(-1), lineup, false)).toBe("The show is over: every comic has gone up.");
  });
  it("empty lineup", () => {
    expect(showStatusLine(idle(0), [], false)).toBe("The lineup is empty.");
  });
  it("host row: the first comic is on deck", () => {
    expect(showStatusLine(idle(0), lineup, true)).toBe("Nobody is on stage right now. Evan is on deck.");
  });
  it("an index outside the lineup never throws", () => {
    expect(showStatusLine(running(9, 1000, 12), lineup, false)).toBe("Nobody is on stage right now. Nobody is after them.");
  });
});
