import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineupEntry, LineupFeed } from "@/lib/openmic/selection";
import type { Spotlight } from "@/lib/openmic/spotlight";
import {
  applyComicMinutes,
  comicMinutes,
  formatClockMinutes,
  parseClockMinutes,
  setComicMinutes,
} from "./set-minutes";

const spot = (over: Partial<Spotlight>): Spotlight => ({ show_date: null, position: null, name: "", set_at: "", set_by: "", ...over });
const row = (name: string, set_length: string, start_time: string, mine = false): LineupEntry =>
  mine ? { name, set_length, start_time, mine } : { name, set_length, start_time };
const feedOf = (lineup: LineupEntry[], me: LineupFeed["me"] = null): LineupFeed => ({ show_date: "2026-11-13", posted: true, lineup, me });

describe("set-minutes", () => {
  it("parseClockMinutes", () => {
    expect(parseClockMinutes("7:05 PM")).toBe(1145);
    expect(parseClockMinutes("12:00 AM")).toBe(0);
    expect(parseClockMinutes("12:30 PM")).toBe(750);
    expect(parseClockMinutes("7:05 pm")).toBe(1145);
    expect(parseClockMinutes("TBD")).toBeNull();
    expect(parseClockMinutes("13:00 PM")).toBeNull();
    expect(parseClockMinutes("7:75 PM")).toBeNull();
  });

  it("formatClockMinutes", () => {
    expect(formatClockMinutes(1145)).toBe("7:05 PM");
    expect(formatClockMinutes(0)).toBe("12:00 AM");
    expect(formatClockMinutes(750)).toBe("12:30 PM");
    expect(formatClockMinutes(1444)).toBe("12:04 AM");
    expect(formatClockMinutes(-1)).toBe("11:59 PM");
  });

  it("comicMinutes", () => {
    const s = spot({ set_minutes: 4, set_minutes_for: "2026-11-13" });
    expect(comicMinutes(s, "2026-11-13")).toBe(4);
    expect(comicMinutes(s, "2026-11-14")).toBeNull();
    expect(comicMinutes(spot({ set_minutes: null, set_minutes_for: "2026-11-13" }), "2026-11-13")).toBeNull();
    expect(comicMinutes(spot({ set_minutes: 0, set_minutes_for: "2026-11-13" }), "2026-11-13")).toBeNull();
    expect(comicMinutes(null, "2026-11-13")).toBeNull();
  });

  it("applyComicMinutes returns the same object when there is nothing to apply", () => {
    const feed = feedOf([row("A", "5 min", "7:00 PM")]);
    expect(applyComicMinutes(null, spot({ set_minutes: 4, set_minutes_for: "2026-11-13" }), true)).toBeNull();
    expect(applyComicMinutes(feed, null, true)).toBe(feed);
    expect(applyComicMinutes(feed, spot({ set_minutes: null, set_minutes_for: "2026-11-13" }), true)).toBe(feed);
    expect(applyComicMinutes(feed, spot({ set_minutes: 4, set_minutes_for: "2026-11-14" }), true)).toBe(feed);
  });

  it("applies the hosts' minutes with the host row on", () => {
    const lineup = [
      row("Viradeth", "5 min", "7:00 PM"),
      row("Karen", "3 min", "7:05 PM"),
      row("Evan", "3 min", "7:08 PM"),
      row("Test", "3 min", "7:11 PM"),
    ];
    const feed = feedOf(lineup);
    const result = applyComicMinutes(feed, spot({ set_minutes: 4, set_minutes_for: "2026-11-13" }), true)!;
    expect(result.lineup.map((e) => e.set_length)).toEqual(["5 min", "4 min", "4 min", "4 min"]);
    expect(result.lineup.map((e) => e.start_time)).toEqual(["7:00 PM", "7:05 PM", "7:09 PM", "7:13 PM"]);
    expect(result.lineup.map((e) => e.name)).toEqual(["Viradeth", "Karen", "Evan", "Test"]);
    expect(feed.lineup[1]!.set_length).toBe("3 min");
  });

  it("applies the hosts' minutes with the host row off", () => {
    const lineup = [
      row("Viradeth", "5 min", "7:00 PM"),
      row("Karen", "3 min", "7:05 PM"),
      row("Evan", "3 min", "7:08 PM"),
      row("Test", "3 min", "7:11 PM"),
    ];
    const result = applyComicMinutes(feedOf(lineup), spot({ set_minutes: 4, set_minutes_for: "2026-11-13" }), false)!;
    expect(result.lineup.map((e) => e.set_length)).toEqual(["4 min", "4 min", "4 min", "4 min"]);
    expect(result.lineup.map((e) => e.start_time)).toEqual(["7:00 PM", "7:04 PM", "7:08 PM", "7:12 PM"]);
  });

  it("updates me when the signed-in comic is not the host row", () => {
    const lineup = [
      row("Viradeth", "5 min", "7:00 PM"),
      row("Karen", "3 min", "7:05 PM"),
      row("Evan", "3 min", "7:08 PM", true),
      row("Test", "3 min", "7:11 PM"),
    ];
    const me = { selected: true, set_length: "3 min", start_time: "7:08 PM" };
    const result = applyComicMinutes(feedOf(lineup, me), spot({ set_minutes: 4, set_minutes_for: "2026-11-13" }), true)!;
    expect(result.me).toEqual({ selected: true, set_length: "4 min", start_time: "7:09 PM" });
  });

  it("leaves me alone when the signed-in comic is the host row", () => {
    const lineup = [
      row("Viradeth", "5 min", "7:00 PM", true),
      row("Karen", "3 min", "7:05 PM"),
      row("Evan", "3 min", "7:08 PM"),
      row("Test", "3 min", "7:11 PM"),
    ];
    const me = { selected: true, set_length: "5 min", start_time: "7:00 PM" };
    const result = applyComicMinutes(feedOf(lineup, me), spot({ set_minutes: 4, set_minutes_for: "2026-11-13" }), true)!;
    expect(result.me).toEqual(me);
  });

  it("wraps past midnight", () => {
    const lineup = [
      row("A", "5 min", "11:55 PM"),
      row("B", "3 min", "12:00 AM"),
      row("C", "3 min", "12:03 AM"),
    ];
    const result = applyComicMinutes(feedOf(lineup), spot({ set_minutes: 4, set_minutes_for: "2026-11-13" }), true)!;
    expect(result.lineup.map((e) => e.start_time)).toEqual(["11:55 PM", "12:00 AM", "12:04 AM"]);
  });

  it("leaves start times alone when the first is unparseable", () => {
    const lineup = [row("A", "5 min", "TBD"), row("B", "3 min", "TBD")];
    const result = applyComicMinutes(feedOf(lineup), spot({ set_minutes: 4, set_minutes_for: "2026-11-13" }), true)!;
    expect(result.lineup.map((e) => e.set_length)).toEqual(["5 min", "4 min"]);
    expect(result.lineup.map((e) => e.start_time)).toEqual(["TBD", "TBD"]);
  });

  it("setComicMinutes", async () => {
    const calls: unknown[] = [];
    const fake = (error: { message: string } | null) =>
      ({
        from: (table: string) => ({
          update: (values: unknown) => {
            calls.push([table, values]);
            return { eq: async () => ({ error }) };
          },
        }),
      }) as unknown as SupabaseClient;

    calls.length = 0;
    expect(await setComicMinutes(fake(null), "2026-11-13", 4)).toBeNull();
    expect(calls[0]).toEqual(["lineup_spotlight", { set_minutes: 4, set_minutes_for: "2026-11-13" }]);

    calls.length = 0;
    await setComicMinutes(fake(null), "2026-11-13", 99);
    expect(calls[0]).toEqual(["lineup_spotlight", { set_minutes: 15, set_minutes_for: "2026-11-13" }]);

    calls.length = 0;
    await setComicMinutes(fake(null), "2026-11-13", 0);
    expect(calls[0]).toEqual(["lineup_spotlight", { set_minutes: 1, set_minutes_for: "2026-11-13" }]);

    calls.length = 0;
    await setComicMinutes(fake(null), "2026-11-13", null);
    expect(calls[0]).toEqual(["lineup_spotlight", { set_minutes: null, set_minutes_for: null }]);

    calls.length = 0;
    expect(await setComicMinutes(fake({ message: "nope" }), "2026-11-13", 4)).toBe("nope");
  });
});
