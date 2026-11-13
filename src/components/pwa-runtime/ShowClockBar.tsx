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
  const hot = running && clock.remainingMs <= 10_000;
  const done = !running && clock.nextIndex === -1;
  const digits = running ? formatCountdown(clock.remainingMs) : done ? null : formatCountdown(clock.nextMs);
  const stopLit = running && !!controls && !controls.busy;
  const startLit = !running && !!controls && !controls.busy && (!done || started);
  const litStart = "border-transparent bg-primary text-primary-foreground active:opacity-80";
  const litStop = "border-transparent bg-white text-black active:opacity-80";
  const dim = "border-white/15 bg-transparent text-white/40";
  const button = "min-w-[4.75rem] rounded-2xl border-2 px-4 py-5 text-base font-black tracking-wider disabled:cursor-default";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 px-3">
      <div
        className={
          "pointer-events-auto relative mx-auto flex max-w-md items-center gap-3 rounded-3xl border-2 px-4 py-3 shadow-lg " +
          (over ? "border-red-500 bg-red-950" : hot ? "border-red-500 bg-[#1f1f24]" : running ? "border-primary bg-[#1f1f24]" : "border-white/35 bg-[#1f1f24]")
        }
        role="status"
        aria-live="polite"
      >
        {digits ? (
          <p className={"flex-1 text-[2.75rem] font-black leading-none tabular-nums tracking-tight " + (hot ? "text-red-400" : "text-white")}>{digits}</p>
        ) : (
          <p className="flex-1 text-base font-black leading-tight text-white">That&apos;s the show</p>
        )}
        {controls && (
          <>
            <button type="button" className={`${button} ${stopLit ? litStop : dim}`} disabled={!stopLit} onClick={controls.onStop}>
              STOP
            </button>
            <button type="button" className={`${button} ${startLit ? litStart : dim}`} disabled={!startLit} onClick={done ? controls.onReset : controls.onStart}>
              {done && started ? "RESET" : "START"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
