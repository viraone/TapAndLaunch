// Live start times for the open mic lineup, from the hosts' show clock. The spotlight row is the comic whose clock
// it is: while it runs (stopped_at null) that comic walked on at `set_at`, so every later row is estimated from there
// plus the sheet's set lengths and a short changeover; once it has stopped, the next comic walks on when the hosts
// press START, so no earlier than now. Pure and clock-injected. The sheet's own start_time is the fallback whenever
// there is no usable clock.

import { formatClock } from "@/lib/format-date";
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

  // A stale or nonsense clock must never change the times: it would show rows in the past or the future.
  const nowMs = now.getTime();
  if (anchor - nowMs > ANCHOR_MAX_FUTURE_MS || nowMs - anchor > ANCHOR_MAX_AGE_MS) return labels;

  const stopped = spotlight!.stopped_at ? parseSetAt(spotlight!.stopped_at) : Number.NaN;
  let next: number;
  if (Number.isFinite(stopped)) {
    // The clock's comic has finished; the next one walks on when the hosts press START, so no earlier than now.
    next = Math.max(stopped + CHANGEOVER_MS, nowMs);
  } else {
    // The clock's comic is on stage since the anchor: their actual start to the minute; the rows after them follow.
    labels[at] = { text: formatClock(new Date(Math.floor(anchor / MINUTE_MS) * MINUTE_MS), timeZone), estimated: false };
    next = Math.max(anchor + setMinutes(lineup[at]!.set_length) * MINUTE_MS + CHANGEOVER_MS, nowMs);
  }
  for (let i = at + 1; i < lineup.length; i++) {
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
