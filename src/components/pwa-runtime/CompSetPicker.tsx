"use client";

import { ChevronDown } from "lucide-react";
import { MAX_COMIC_MINUTES, MIN_COMIC_MINUTES } from "@/lib/openmic/set-minutes";

/** One comic in the picker (the hosts row is not in the list): the number they have right now, and whether the hosts gave them their own. */
export type CompTarget = { key: string; name: string; minutes: number; custom: boolean };

/** The hosts' set-length control. The label is a picker: "All comics" (everyone but the hosts) or one comic. The − and + change the
 *  picked target. `allMinutes` is what the hosts dictated for everyone (null = the sheet's own lengths); `fallback` is shown while
 *  nothing is dictated, so the first tap moves from a real number. */
export function CompSetPicker({
  targets,
  selected,
  onSelect,
  allMinutes,
  fallback,
  hasOverrides,
  saving,
  error,
  onChange,
}: {
  targets: CompTarget[];
  selected: string;
  onSelect: (key: string) => void;
  allMinutes: number | null;
  fallback: number;
  hasOverrides: boolean;
  saving: boolean;
  error: string | null;
  onChange: (minutes: number | null) => void;
}) {
  const target = selected === "" ? undefined : targets.find((t) => t.key === selected);
  const shown = target ? target.minutes : (allMinutes ?? fallback);
  // The picked comic's full name is repeated here because the picker cuts a long name short on a phone.
  const sub = target ? `${target.name} · ${target.custom ? "Just this comic" : "Same as everyone"}` : allMinutes !== null ? "Set by the hosts tonight" : hasOverrides ? "From the sheet, some changed" : "From the sheet";
  const resetLabel = target ? (target.custom ? "Same as everyone" : null) : hasOverrides ? "Back to the sheet" : null;
  const step = "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white transition active:scale-95 disabled:opacity-40";
  return (
    <section aria-label="Set length for the comics" className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="relative inline-block max-w-full">
            <label htmlFor="comic-sets-target" className="sr-only">
              Who the set length is for
            </label>
            <select
              id="comic-sets-target"
              value={target ? target.key : ""}
              onChange={(event) => onSelect(event.target.value)}
              disabled={saving}
              className="max-w-full appearance-none truncate bg-transparent py-0.5 pr-6 text-[13px] font-semibold uppercase tracking-wide text-white/80 outline-none"
            >
              <option value="">All comics</option>
              {targets.map((t) => (
                <option key={t.key} value={t.key}>
                  {`${t.name} · ${t.minutes} min`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden="true" />
          </div>
          <p className="text-[12px] text-white/50">{sub}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-label="One minute less" disabled={saving || shown <= MIN_COMIC_MINUTES} onClick={() => onChange(shown - 1)} className={step}>
            −
          </button>
          <span className="min-w-[4.5rem] text-center text-2xl font-black tabular-nums text-white">{shown} min</span>
          <button type="button" aria-label="One minute more" disabled={saving || shown >= MAX_COMIC_MINUTES} onClick={() => onChange(shown + 1)} className={step}>
            +
          </button>
        </div>
      </div>
      {resetLabel && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onChange(null)}
          className="mt-2 text-[13px] font-semibold text-sky-400 underline-offset-2 active:underline disabled:opacity-40"
        >
          {resetLabel}
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
