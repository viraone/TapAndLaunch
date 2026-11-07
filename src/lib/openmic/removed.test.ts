import { describe, expect, it } from "vitest";
import { applyRemovals, nextRemoved, normalizeName, readLineupRemoved } from "./removed";
import type { LineupFeed } from "./selection";

function feed(overrides: Partial<LineupFeed> = {}): LineupFeed {
  return {
    show_date: "2026-11-06",
    posted: true,
    lineup: [
      { name: "English John", set_length: "5 min", start_time: "8:00 PM", mine: true },
      { name: "David Chen", set_length: "5 min", start_time: "8:05 PM" },
      { name: "Lori Peck", set_length: "5 min", start_time: "8:10 PM" },
    ],
    me: { selected: true, set_length: "5 min", start_time: "8:00 PM" },
    ...overrides,
  };
}

describe("normalizeName", () => {
  it("trims, collapses spaces and lower-cases", () => {
    expect(normalizeName("  English   John ")).toBe("english john");
    expect(normalizeName("ENGLISH JOHN")).toBe("english john");
  });
});

describe("readLineupRemoved", () => {
  it("reads a stored list", () => {
    expect(readLineupRemoved({ show_date: "2026-11-06", names: ["English John"] })).toEqual({
      show_date: "2026-11-06",
      names: ["English John"],
    });
  });

  it("drops anything that is not a list of names", () => {
    expect(readLineupRemoved(null)).toBeNull();
    expect(readLineupRemoved("English John")).toBeNull();
    expect(readLineupRemoved({ names: ["English John"] })).toBeNull();
    expect(readLineupRemoved({ show_date: "2026-11-06", names: ["English John", 7] })).toEqual({
      show_date: "2026-11-06",
      names: ["English John"],
    });
  });
});

describe("applyRemovals", () => {
  it("ignores a list for another show date", () => {
    const unchanged = feed();
    expect(applyRemovals(unchanged, { show_date: "2026-10-30", names: ["English John"] })).toBe(unchanged);
  });

  it("ignores a missing list", () => {
    const unchanged = feed();
    expect(applyRemovals(unchanged, null)).toBe(unchanged);
    expect(applyRemovals(unchanged, undefined)).toBe(unchanged);
  });

  it("filters the removed names out of tonight's lineup", () => {
    const result = applyRemovals(feed(), { show_date: "2026-11-06", names: ["English John"] });
    expect(result.lineup.map((entry) => entry.name)).toEqual(["David Chen", "Lori Peck"]);
  });

  it("matches a name with different case and spacing", () => {
    const result = applyRemovals(feed(), { show_date: "2026-11-06", names: [" english  john "] });
    expect(result.lineup.map((entry) => entry.name)).toEqual(["David Chen", "Lori Peck"]);
  });

  it("clears me when the signed-in comic's own row is removed", () => {
    const result = applyRemovals(feed(), { show_date: "2026-11-06", names: ["English John"] });
    expect(result.me).toBeNull();
  });

  it("keeps me when another comic is removed", () => {
    const original = feed();
    const result = applyRemovals(original, { show_date: "2026-11-06", names: ["David Chen"] });
    expect(result.me).toEqual(original.me);
    expect(result.lineup.map((entry) => entry.name)).toEqual(["English John", "Lori Peck"]);
  });

  it("does not change the feed it was given", () => {
    const original = feed();
    applyRemovals(original, { show_date: "2026-11-06", names: ["English John"] });
    expect(original.lineup).toHaveLength(3);
    expect(original.me?.selected).toBe(true);
  });
});

describe("nextRemoved", () => {
  it("adds a name, trimmed", () => {
    expect(nextRemoved(null, "2026-11-06", "remove", "  English John  ")).toEqual({
      show_date: "2026-11-06",
      names: ["English John"],
    });
  });

  it("does not add the same comic twice, whatever the case or spacing", () => {
    const current = { show_date: "2026-11-06", names: ["English John"] };
    expect(nextRemoved(current, "2026-11-06", "remove", " english   john ")).toEqual(current);
  });

  it("restores a removed comic", () => {
    const current = { show_date: "2026-11-06", names: ["English John", "David Chen"] };
    expect(nextRemoved(current, "2026-11-06", "restore", "english john")).toEqual({
      show_date: "2026-11-06",
      names: ["David Chen"],
    });
  });

  it("does nothing when restoring a name that is not removed", () => {
    const current = { show_date: "2026-11-06", names: ["David Chen"] };
    expect(nextRemoved(current, "2026-11-06", "restore", "Lori Peck")).toEqual(current);
  });

  it("starts a fresh list for a different show date", () => {
    const current = { show_date: "2026-10-30", names: ["English John"] };
    expect(nextRemoved(current, "2026-11-06", "remove", "Lori Peck")).toEqual({
      show_date: "2026-11-06",
      names: ["Lori Peck"],
    });
    expect(nextRemoved(current, "2026-11-06", "restore", "English John")).toEqual({
      show_date: "2026-11-06",
      names: [],
    });
  });

  it("starts a fresh list with no input", () => {
    expect(nextRemoved(undefined, "2026-11-06", "remove", "Lori Peck")).toEqual({
      show_date: "2026-11-06",
      names: ["Lori Peck"],
    });
  });

  it("does not change the list it was given", () => {
    const current = { show_date: "2026-11-06", names: ["English John"] };
    nextRemoved(current, "2026-11-06", "remove", "David Chen");
    nextRemoved(current, "2026-11-06", "restore", "English John");
    expect(current.names).toEqual(["English John"]);
  });
});
