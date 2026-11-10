// One set length for every comic, dictated by the hosts on the Timer tab and stored on the show clock row
// (lineup_spotlight.set_minutes, good only for the show date in set_minutes_for). The sheet stays read-only, so the
// override is laid over the feed after each fetch, like removed.ts does for removals.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineupEntry, LineupFeed } from "@/lib/openmic/selection";
import type { Spotlight } from "@/lib/openmic/spotlight";
import { setMinutes } from "@/lib/openmic/start-times";

export const MIN_COMIC_MINUTES = 1;
export const MAX_COMIC_MINUTES = 15;

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

/** The feed with every comic's set length replaced by the hosts' number. With the host row on, row 0 is the hosts and keeps its
 *  own length. Start times are worked out again from row 0's start time (no changeover, like the sheet). The input is never
 *  changed; with nothing to apply the very same feed object comes back. */
export function applyComicMinutes(feed: LineupFeed | null, spotlight: Spotlight | null, hostRow: boolean): LineupFeed | null {
  if (!feed) return feed;
  const minutes = comicMinutes(spotlight, feed.show_date);
  if (minutes === null) return feed;
  const label = `${minutes} min`;
  const first = hostRow ? 1 : 0;
  const lineup: LineupEntry[] = feed.lineup.map((entry, i) => (i >= first ? { ...entry, set_length: label } : entry));
  const base = lineup.length > 0 ? parseClockMinutes(lineup[0]!.start_time) : null;
  if (base !== null) {
    let at = base;
    for (let i = 0; i < lineup.length; i++) {
      if (i > 0) lineup[i] = { ...lineup[i]!, start_time: formatClockMinutes(at) };
      at += setMinutes(lineup[i]!.set_length);
    }
  }
  const mineIndex = lineup.findIndex((entry) => entry.mine === true);
  const me =
    feed.me && !(hostRow && mineIndex === 0)
      ? { ...feed.me, set_length: label, start_time: mineIndex >= 0 ? lineup[mineIndex]!.start_time : feed.me.start_time }
      : feed.me;
  return { ...feed, lineup, me };
}

/** Hosts only (the database refuses anyone else). `minutes` null goes back to the sheet's lengths. Returns an error message or null. */
export async function setComicMinutes(client: SupabaseClient, showDate: string, minutes: number | null): Promise<string | null> {
  const value = minutes === null ? null : Math.min(MAX_COMIC_MINUTES, Math.max(MIN_COMIC_MINUTES, Math.round(minutes)));
  const { error } = await client
    .from("lineup_spotlight")
    .update({ set_minutes: value, set_minutes_for: value === null ? null : showDate })
    .eq("id", 1);
  return error ? error.message : null;
}
