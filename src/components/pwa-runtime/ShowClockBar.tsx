"use client";

import type { ShowClock } from "@/lib/openmic/show-clock";
import { formatCountdown } from "@/lib/openmic/tv-timer";

/** The hosts' three actions. Absent for a comic's phone, which only watches. */
export type ShowClockControls = {
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  /** A save is in flight: both buttons sit dim until it returns. */
  busy: boolean;
};

/**
 * The show clock, pinned above the tab bar: the digits on the left, STOP and START on the right for hosts. Running:
 * the countdown, red and counting up past the set length. Idle before the show or between comics: the next comic's
 * set length, still. Idle with nobody left (and the show had started): "That's the show" and RESET in START's place.
 * Both buttons are always there so a host's thumb learns where they are; only the one that applies is lit.
 */
export function ShowClockBar({ clock, started, controls }: { clock: ShowClock; started: boolean; controls?: ShowClockControls }) {
  const running = clock.kind === "running";
  const over = running && clock.remainingMs < 0;
  const done = !running && clock.nextIndex === -1;
  const digits = running ? formatCountdown(clock.remainingMs) : done ? null : formatCountdown(clock.nextMs);
  const stopLit = running && !!controls && !controls.busy;
  const startLit = !running && !!controls && !controls.busy && (!done || started);
  const lit = "bg-primary text-primary-foreground active:opacity-80";
  const dim = "bg-muted text-muted-foreground";
  const button = "min-w-[4.5rem] rounded-xl px-4 py-3 text-sm font-black tracking-wider disabled:cursor-default";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 px-3">
      <div
        className={
          "pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg " +
          (over ? "border-red-500/60 bg-red-950" : "border-white/10 bg-card")
        }
        role="status"
        aria-live="polite"
      >
        {digits ? (
          <p className={"flex-1 text-4xl font-black tabular-nums tracking-tight " + (over ? "text-red-400" : running ? "text-foreground" : "text-muted-foreground")}>{digits}</p>
        ) : (
          <p className="flex-1 text-lg font-bold text-foreground">That&apos;s the show</p>
        )}
        {controls && (
          <>
            <button type="button" className={`${button} ${stopLit ? lit : dim}`} disabled={!stopLit} onClick={controls.onStop}>
              STOP
            </button>
            <button type="button" className={`${button} ${startLit ? lit : dim}`} disabled={!startLit} onClick={done ? controls.onReset : controls.onStart}>
              {done && started ? "RESET" : "START"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
