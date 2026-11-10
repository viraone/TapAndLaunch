"use client";

import { MAX_COMIC_MINUTES, MIN_COMIC_MINUTES } from "@/lib/openmic/set-minutes";

/** The hosts' one-number set length for every comic. `minutes` is what the hosts dictated (null = the sheet's own lengths);
 *  `fallback` is shown while nothing is dictated, so the first tap moves from a real number. */
export function CompSetLength({
  minutes,
  fallback,
  saving,
  error,
  onChange,
}: {
  minutes: number | null;
  fallback: number;
  saving: boolean;
  error: string | null;
  onChange: (minutes: number | null) => void;
}) {
  const shown = minutes ?? fallback;
  const step = "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white transition active:scale-95 disabled:opacity-40";
  return (
    <section aria-label="Set length for the comics" className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wide text-white/60">Comic sets</p>
          <p className="text-[12px] text-white/50">{minutes === null ? "From the sheet" : "Set by the hosts tonight"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="One minute less" disabled={saving || shown <= MIN_COMIC_MINUTES} onClick={() => onChange(shown - 1)} className={step}>
            −
          </button>
          <span className="min-w-[4.5rem] text-center text-2xl font-black tabular-nums text-white">{shown} min</span>
          <button type="button" aria-label="One minute more" disabled={saving || shown >= MAX_COMIC_MINUTES} onClick={() => onChange(shown + 1)} className={step}>
            +
          </button>
        </div>
      </div>
      {minutes !== null && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onChange(null)}
          className="mt-2 text-[13px] font-semibold text-sky-400 underline-offset-2 active:underline disabled:opacity-40"
        >
          Back to the sheet
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
