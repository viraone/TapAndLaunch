import type { LineupEntry } from "@/lib/openmic/selection";
import { spotlightIndex, type Spotlight } from "@/lib/openmic/spotlight";
import { ANCHOR_MAX_AGE_MS, ANCHOR_MAX_FUTURE_MS, parseSetAt, setMinutes, type StartLabel } from "@/lib/openmic/start-times";

/** What the venue's TV shows under the flyer: the comic on stage with the time left in their set, and who is next. */
export type TvTimer =
  | { kind: "idle"; nextName: string | null; nextAt: string | null }
  | { kind: "on"; name: string; remainingMs: number; totalMs: number; nextName: string | null; nextAt: string | null };

export type TimerTone = "calm" | "warn" | "urgent" | "over";

/** How the TV timer looks for the time left: past zero is "over", 10 s or less "urgent", 30 s or less "warn", else "calm". */
export function timerTone(ms: number): TimerTone {
  if (ms < 0) return "over";
  if (ms <= 10_000) return "urgent";
  if (ms <= 30_000) return "warn";
  return "calm";
}

/** 300000 → "5:00", 7000 → "0:07", 0 → "0:00", -15000 → "+0:15" (over time). */
export function formatCountdown(ms: number): string {
  const over = ms < 0;
  const s = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${over ? "+" : ""}${m}:${r < 10 ? "0" : ""}${r}`;
}

/**
 * Same rules as estimateStartTimes: the spotlight marks who is on deck, the row before it is on stage since
 * `set_at`, and a spotlight that is stale or in the future is ignored. `startLabels` are the labels the phones show.
 */
export function tvTimer(input: { lineup: LineupEntry[]; spotlight: Spotlight | null; showDate: string; startLabels: StartLabel[]; now: Date }): TvTimer {
  const { lineup, spotlight, showDate, startLabels, now } = input;
  const at = spotlightIndex(spotlight, lineup, showDate);
  const setAt = spotlight ? parseSetAt(spotlight.set_at) : Number.NaN;
  const age = now.getTime() - setAt;
  const usable = at >= 1 && Number.isFinite(setAt) && age <= ANCHOR_MAX_AGE_MS && age >= -ANCHOR_MAX_FUTURE_MS;
  const next = (i: number) => ({ nextName: lineup[i]?.name ?? null, nextAt: startLabels[i]?.text ?? null });
  if (!usable) return { kind: "idle", ...next(at >= 0 ? at : 0) };
  const onStage = lineup[at - 1];
  const totalMs = setMinutes(onStage.set_length) * 60_000;
  const remainingMs = setAt + totalMs - now.getTime();
  return { kind: "on", name: onStage.name, remainingMs, totalMs, ...next(at) };
}

