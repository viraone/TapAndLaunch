// Live start times for the open mic lineup. When a host moves the spotlight, the row after it is on deck and the
// row before it walks on stage at that moment, so every row from the on-deck one onwards can be estimated from
// `set_at` plus the sheet's set lengths and a short changeover. Pure and clock-injected, so it is tested without
// a browser. The sheet's own start_time is the fallback whenever there is no usable spotlight.

import { zonedTimeToUtc } from "@/lib/apps/sample-events";
import { formatClock } from "@/lib/format-date";
import { parseTimeStringToMinutes } from "@/lib/listings/parse";
import { spotlightIndex, type Spotlight } from "@/lib/openmic/spotlight";
import type { LineupEntry } from "@/lib/openmic/selection";

/** Between one comic leaving the stage and the next walking on. */
export const CHANGEOVER_SECONDS = 45;

/** Used when a row's set length is empty, has no number, or is zero. */
export const DEFAULT_SET_MINUTES = 3;

/** A highlight older than this is stale (a previous show, or a test), so it must not move the times. */
export const ANCHOR_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/** A highlight further ahead than this is nonsense for the same reason. */
export const ANCHOR_MAX_FUTURE_MS = 2 * 60 * 1000;

const MINUTE_MS = 60_000;
const CHANGEOVER_MS = CHANGEOVER_SECONDS * 1000;

export type StartLabel = { text: string; estimated: boolean };

/** Epoch ms for a spotlight's `set_at`. Postgres can return a timestamp without a zone designator ("2026-11-07T03:05:30"
 *  or "2026-11-07 03:05:30.12"); the database clock is UTC, so those are read as UTC. A string that already carries
 *  a designator is parsed as it is. Unparseable -> NaN. */
export function parseSetAt(value: string): number {
  const text = value.trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(text)) return Date.parse(text);
  return Date.parse(`${text.replace(" ", "T")}Z`);
}

/** Minutes in a sheet set length: "5 min" -> 5, "7" -> 7, "3 minutes" -> 3; anything unusable -> 3. */
export function setMinutes(setLength: string): number {
  const match = /\d+/.exec(setLength);
  if (!match) return DEFAULT_SET_MINUTES;
  const minutes = Number(match[0]);
  return minutes > 0 ? minutes : DEFAULT_SET_MINUTES;
}

/** One label per lineup row, in order. `estimated` is true when the time was worked out from the spotlight, so
 *  the UI can mark it with a tilde. */
export function estimateStartTimes(input: {
  lineup: LineupEntry[];
  spotlight: Spotlight | null;
  showDate: string;
  timeZone: string;
  now: Date;
}): StartLabel[] {
  const { lineup, spotlight, showDate, timeZone, now } = input;
  const labels: StartLabel[] = lineup.map((entry) => ({ text: entry.start_time, estimated: false }));
  const at = spotlightIndex(spotlight, lineup, showDate);
  const anchor = spotlight ? parseSetAt(spotlight.set_at) : Number.NaN;
  if (at === -1 || !Number.isFinite(anchor)) return labels;

  // A stale or nonsense highlight must never change the times: it would show rows in the past or the future.
  const nowMs = now.getTime();
  if (anchor - nowMs > ANCHOR_MAX_FUTURE_MS || nowMs - anchor > ANCHOR_MAX_AGE_MS) return labels;

  if (at === 0) {
    // Nobody has walked on yet. The sheet time stands until it has passed; after that the show is late and starts now.
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(showDate);
    const startMinutes = parts ? parseTimeStringToMinutes(lineup[0]?.start_time) : null;
    if (!parts || startMinutes === null) return labels;
    const sheetStart = zonedTimeToUtc(Number(parts[1]), Number(parts[2]), Number(parts[3]), Math.floor(startMinutes / 60), startMinutes % 60, timeZone);
    if (now.getTime() <= sheetStart.getTime()) return labels;
    labels[0] = estimatedLabel(now.getTime(), timeZone);
    let next = now.getTime() + setMinutes(lineup[0]!.set_length) * MINUTE_MS + CHANGEOVER_MS;
    for (let i = 1; i < lineup.length; i++) {
      labels[i] = estimatedLabel(next, timeZone);
      next += setMinutes(lineup[i]!.set_length) * MINUTE_MS + CHANGEOVER_MS;
    }
    return labels;
  }

  // The row before the highlight is on stage now: the host moved it as that comic walked on. Its actual start is
  // the anchor to the minute; the row after it is on deck and must not be estimated in the past.
  labels[at - 1] = { text: formatClock(new Date(Math.floor(anchor / MINUTE_MS) * MINUTE_MS), timeZone), estimated: false };
  let next = Math.max(anchor + setMinutes(lineup[at - 1]!.set_length) * MINUTE_MS + CHANGEOVER_MS, now.getTime());
  for (let i = at; i < lineup.length; i++) {
    labels[i] = estimatedLabel(next, timeZone);
    next += setMinutes(lineup[i]!.set_length) * MINUTE_MS + CHANGEOVER_MS;
  }
  return labels;
}

/** The estimated label for a start, rounded to the nearest minute and marked with a tilde. */
function estimatedLabel(epochMs: number, timeZone: string): StartLabel {
  const rounded = Math.round(epochMs / MINUTE_MS) * MINUTE_MS;
  return { text: `~${formatClock(new Date(rounded), timeZone)}`, estimated: true };
}
