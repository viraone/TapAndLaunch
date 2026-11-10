// One set length for every comic, dictated by the hosts on the Timer tab and stored on the show clock row
// (lineup_spotlight.set_minutes, good only for the show date in set_minutes_for). The sheet stays read-only, so the
// override is laid over the feed after each fetch, like removed.ts does for removals.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineupEntry, LineupFeed } from "@/lib/openmic/selection";
import type { Spotlight } from "@/lib/openmic/spotlight";
import { setMinutes } from "@/lib/openmic/start-times";

export const MIN_COMIC_MINUTES = 1;
export const MAX_COMIC_MINUTES = 15;

/** A name as the lookup key for one comic's number: trimmed, inner spaces collapsed, lower case. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** What the hosts dictated for single comics tonight, by nameKey. Only counts for this show date; anything that is not a whole number from 1 to 15 is dropped. */
export function eachMinutes(spotlight: Spotlight | null | undefined, showDate: string): Record<string, number> {
  const each = spotlight?.set_each;
  if (!each || each.for !== showDate || !each.minutes || typeof each.minutes !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(each.minutes)) {
    if (typeof value === "number" && Number.isInteger(value) && value >= MIN_COMIC_MINUTES && value <= MAX_COMIC_MINUTES) out[key] = value;
  }
  return out;
}

/** "7:05 PM" -> minutes since midnight (1145); null when it is not a 12-hour clock time. */
export function parseClockMinutes(text: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*([AaPp])[Mm]\s*$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return ((hour % 12) + (match[3]!.toLowerCase() === "p" ? 12 : 0)) * 60 + minute;
}

/** Minutes since midnight (wraps past midnight, negative wraps back) -> "7:05 PM". */
export function formatClockMinutes(total: number): string {
  const day = ((total % 1440) + 1440) % 1440;
  const hour24 = Math.floor(day / 60);
  const minute = day % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${hour24 < 12 ? "AM" : "PM"}`;
}

/** The hosts' set length for this show date, or null when none is set, it is for another night, or it is nonsense. */
export function comicMinutes(spotlight: Spotlight | null | undefined, showDate: string): number | null {
  const minutes = spotlight?.set_minutes;
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 1) return null;
  return spotlight?.set_minutes_for === showDate ? minutes : null;
}

/** The feed with every comic's set length replaced by the hosts' number, except a comic's own number wins over the everyone-number.
 *  With the host row on, row 0 is the hosts and keeps its own length. Start times are worked out again from row 0's start time
 *  (no changeover, like the sheet). The input is never changed; with nothing to apply the very same feed object comes back. */
export function applyComicMinutes(feed: LineupFeed | null, spotlight: Spotlight | null, hostRow: boolean): LineupFeed | null {
  if (!feed) return feed;
  const all = comicMinutes(spotlight, feed.show_date);
  const each = eachMinutes(spotlight, feed.show_date);
  if (all === null && Object.keys(each).length === 0) return feed;
  const first = hostRow ? 1 : 0;
  const lineup: LineupEntry[] = feed.lineup.map((entry, i) => {
    if (i < first) return entry;
    const minutes = each[nameKey(entry.name)] ?? all;
    return minutes === null ? entry : { ...entry, set_length: `${minutes} min` };
  });
  const base = lineup.length > 0 ? parseClockMinutes(lineup[0]!.start_time) : null;
  if (base !== null) {
    let at = base;
    for (let i = 0; i < lineup.length; i++) {
      if (i > 0) lineup[i] = { ...lineup[i]!, start_time: formatClockMinutes(at) };
      at += setMinutes(lineup[i]!.set_length);
    }
  }
  const mineIndex = lineup.findIndex((entry) => entry.mine === true);
  const me = feed.me && mineIndex >= first ? { ...feed.me, set_length: lineup[mineIndex]!.set_length, start_time: lineup[mineIndex]!.start_time } : feed.me;
  return { ...feed, lineup, me };
}

/** Hosts only (the database refuses anyone else). `minutes` null goes back to the sheet's lengths and clears every single-comic number. Returns an error message or null. */
export async function setComicMinutes(client: SupabaseClient, showDate: string, minutes: number | null): Promise<string | null> {
  const value = minutes === null ? null : Math.min(MAX_COMIC_MINUTES, Math.max(MIN_COMIC_MINUTES, Math.round(minutes)));
  const { error } = await client
    .from("lineup_spotlight")
    .update({ set_minutes: value, set_minutes_for: value === null ? null : showDate, ...(value === null ? { set_each: null } : {}) })
    .eq("id", 1);
  return error ? error.message : null;
}

/** One comic's own length (hosts only). `current` is the single-comic map as it is now (eachMinutes); `minutes` null removes that comic's number. Returns an error message or null. */
export async function setEachMinutes(client: SupabaseClient, showDate: string, current: Record<string, number>, name: string, minutes: number | null): Promise<string | null> {
  const next = { ...current };
  const key = nameKey(name);
  if (minutes === null) delete next[key];
  else next[key] = Math.min(MAX_COMIC_MINUTES, Math.max(MIN_COMIC_MINUTES, Math.round(minutes)));
  const { error } = await client
    .from("lineup_spotlight")
    .update({ set_each: Object.keys(next).length > 0 ? { for: showDate, minutes: next } : null })
    .eq("id", 1);
  return error ? error.message : null;
}
