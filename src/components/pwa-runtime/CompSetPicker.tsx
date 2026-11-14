"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
  defaultOpen = false,
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
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const target = selected === "" ? undefined : targets.find((t) => t.key === selected);
  const shown = target ? target.minutes : (allMinutes ?? fallback);
  // The picked comic's full name is repeated here because the picker cuts a long name short on a phone.
  const sub = target ? `${target.name} · ${target.custom ? "Just this comic" : "Same as everyone"}` : allMinutes !== null ? "Set by the hosts tonight" : hasOverrides ? "From the sheet, some changed" : "From the sheet";
  const resetLabel = target ? (target.custom ? "Same as everyone" : null) : hasOverrides ? "Back to the sheet" : null;
  const pick = (key: string) => {
    onSelect(key);
    setOpen(false);
  };
  const rowClass = (on: boolean) =>
    "flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 py-3 text-left text-[18px] font-semibold transition active:bg-white/10 " + (on ? "bg-sky-400/20 text-white" : "text-white/90");
  const step = "flex h-14 w-14 items-center justify-center rounded-full bg-sky-400 text-3xl font-black text-black shadow-md transition active:scale-95 disabled:opacity-40";
  return (
    <section aria-label="Set length for the comics" className="relative mt-6 rounded-2xl border-2 border-sky-400/80 bg-sky-400/10 px-4 pb-4 pt-5 shadow-[0_0_24px_rgba(56,189,248,0.18)]">
      <span className="absolute -top-2.5 left-4 rounded-full bg-sky-400 px-2.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-[0.2em] text-black">Set length</span>
      <p className="text-[17px] font-bold text-white">How long is each set?</p>
      <div className="mt-3">
        <label htmlFor="comic-sets-target" className="sr-only">
          Who the set length is for
        </label>
        <button
          type="button"
          id="comic-sets-target"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={saving}
          onClick={() => setOpen((v) => !v)}
          className="flex h-14 w-full items-center justify-between gap-3 rounded-xl border border-white/20 bg-black/30 px-4 text-left text-[19px] font-bold text-white outline-none transition active:bg-black/50 disabled:opacity-40"
        >
          <span className="min-w-0 truncate">{target ? `${target.name} · ${target.minutes} min` : "All comics (everyone)"}</span>
          <ChevronDown className={"h-6 w-6 shrink-0 text-sky-400 transition " + (open ? "rotate-180" : "")} aria-hidden="true" />
        </button>
        {open && (
          <ul role="listbox" aria-label="Who the set length is for" className="mt-2 max-h-72 overflow-y-auto overflow-x-hidden rounded-xl border border-white/15 bg-black/40">
            <li role="option" aria-selected={!target}>
              <button type="button" onClick={() => pick("")} className={rowClass(!target)}>
                <span className="min-w-0 flex-1 break-words">All comics (everyone)</span>
                {!target && <Check className="h-6 w-6 shrink-0 text-sky-400" aria-hidden="true" />}
              </button>
            </li>
            {targets.map((t) => {
              const on = !!target && target.key === t.key;
              return (
                <li key={t.key} role="option" aria-selected={on}>
                  <button type="button" onClick={() => pick(t.key)} className={rowClass(on)}>
                    <span className="min-w-0 flex-1 break-words">{t.name}</span>
                    <span className="shrink-0 tabular-nums text-white/60">{t.minutes} min</span>
                    {on && <Check className="h-6 w-6 shrink-0 text-sky-400" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" aria-label="One minute less" disabled={saving || shown <= MIN_COMIC_MINUTES} onClick={() => onChange(shown - 1)} className={step}>
          −
        </button>
        <span className="text-center text-4xl font-black tabular-nums text-white">{shown} min</span>
        <button type="button" aria-label="One minute more" disabled={saving || shown >= MAX_COMIC_MINUTES} onClick={() => onChange(shown + 1)} className={step}>
          +
        </button>
      </div>
      <p className="mt-3 text-center text-[14px] text-white/60">{sub}</p>
      {resetLabel && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onChange(null)}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-sky-400/60 text-[15px] font-bold text-sky-400 active:bg-sky-400/10 disabled:opacity-40"
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
