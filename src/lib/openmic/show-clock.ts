// The show clock: the hosts press START as a comic walks on and STOP as they walk off. The spotlight row holds
// whose clock it is (position), when it started (set_at) and whether it has stopped (stopped_at), plus every
// finished set (sets). Every screen computes the same countdown from those, so they tick the same second. Pure.

import type { LineupEntry } from "@/lib/openmic/selection";
import { shortName } from "@/lib/openmic/signed-in-name";
import { spotlightIndex, type SetRecord, type Spotlight } from "@/lib/openmic/spotlight";
import { ANCHOR_MAX_AGE_MS, ANCHOR_MAX_FUTURE_MS, parseSetAt, setMinutes } from "@/lib/openmic/start-times";
import { formatCountdown } from "@/lib/openmic/tv-timer";

const MINUTE_MS = 60_000;

export type ShowClock =
  /** Nobody's clock is running: before START, or between comics after STOP. nextIndex -1 = the show is over. */
  | { kind: "idle"; nextIndex: number; nextMs: number }
  /** A comic is on stage; remainingMs goes negative past their set length. onDeckIndex -1 = last comic. */
  | { kind: "running"; index: number; remainingMs: number; totalMs: number; onDeckIndex: number };

/** Which row the first START goes to: row 0, unless row 0 is the host's own name (the host opens the show untimed). */
export function firstComicIndex(lineup: LineupEntry[], hostName: string | null | undefined, hostRow = false): number {
  if (lineup.length === 0) return -1;
  if (hostRow) return 0;
  const host = (hostName ?? "").trim().toLowerCase();
  if (!host) return 0;
  const first = lineup[0]!.name.trim().toLowerCase();
  const isHost = first === host || first === shortName(hostName ?? "").trim().toLowerCase();
  return isHost && lineup.length > 1 ? 1 : 0;
}

function idleFor(lineup: LineupEntry[], nextIndex: number): ShowClock {
  const entry = nextIndex >= 0 ? lineup[nextIndex] : undefined;
  return { kind: "idle", nextIndex: entry ? nextIndex : -1, nextMs: entry ? setMinutes(entry.set_length) * MINUTE_MS : 0 };
}

/** The clock right now. A spotlight for another show day, or one started more than 3 hours ago, counts as nothing. */
export function showClock(input: { lineup: LineupEntry[]; spotlight: Spotlight | null; showDate: string; hostName?: string | null; hostRow?: boolean; now: Date }): ShowClock {
  const { lineup, spotlight, showDate, hostName, hostRow, now } = input;
  const at = spotlightIndex(spotlight, lineup, showDate);
  const startMs = spotlight ? parseSetAt(spotlight.set_at) : Number.NaN;
  const age = now.getTime() - startMs;
  const fresh = Number.isFinite(startMs) && age <= ANCHOR_MAX_AGE_MS && age >= -ANCHOR_MAX_FUTURE_MS;
  if (at === -1 || !fresh) return idleFor(lineup, firstComicIndex(lineup, hostName, hostRow));
  if (spotlight!.stopped_at) return idleFor(lineup, at + 1);
  const totalMs = setMinutes(lineup[at]!.set_length) * MINUTE_MS;
  return { kind: "running", index: at, remainingMs: startMs + totalMs - now.getTime(), totalMs, onDeckIndex: at + 1 < lineup.length ? at + 1 : -1 };
}

/** The row to ring as ON DECK. With the host row on, row 0 is the hosts, so until a clock runs the first comic (row 1) is on deck. */
export function onDeckFor(clock: ShowClock, lineupLength: number, hostRow: boolean): number {
  if (clock.kind === "running") return clock.onDeckIndex;
  if (hostRow && clock.nextIndex === 0) return lineupLength > 1 ? 1 : -1;
  return clock.nextIndex;
}

/** The finished set for a row: by position and name, else by name alone (the host moved rows), else undefined. */
export function finishedRecord(sets: SetRecord[] | undefined, index: number, name: string): SetRecord | undefined {
  if (!sets) return undefined;
  return sets.find((s) => s.position === index && s.name === name) ?? sets.find((s) => s.name === name);
}

/** How a finished comic did: "2:50" (their time on stage) when inside their set length, "+0:40" when over. */
export function finishedLabel(record: SetRecord | undefined, setLength: string): string | null {
  if (!record) return null;
  const started = parseSetAt(record.started_at);
  const stopped = parseSetAt(record.stopped_at);
  if (!Number.isFinite(started) || !Number.isFinite(stopped) || stopped < started) return null;
  const over = stopped - started - setMinutes(setLength) * MINUTE_MS;
  return over > 0 ? formatCountdown(-over) : formatCountdown(stopped - started);
}

/** How much of a running set has gone, 0 to 100 (clamped, so 100 once over time); undefined when no clock runs. */
export function clockProgress(clock: ShowClock): number | undefined {
  if (clock.kind !== "running") return undefined;
  return Math.max(0, Math.min(100, 100 * (1 - clock.remainingMs / clock.totalMs)));
}
