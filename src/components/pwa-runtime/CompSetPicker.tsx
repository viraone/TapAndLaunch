"use client";

import { useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { MAX_COMIC_MINUTES, MIN_COMIC_MINUTES } from "@/lib/openmic/set-minutes";

/** The one-tap lengths under the number. All sit inside MIN_COMIC_MINUTES..MAX_COMIC_MINUTES. */
const QUICK_MINUTES = [2, 3, 4, 5, 7, 10];

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
  onChange: (minutes: number | null) => Promise<boolean> | void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState<number | null>(null);
  const target = selected === "" ? undefined : targets.find((t) => t.key === selected);
  const current = target ? target.minutes : (allMinutes ?? fallback);
  const shown = draft ?? current;
  const dirty = draft !== null && draft !== current;
  const forName = target ? target.name : "everyone";
  const save = async () => {
    if (draft === null) return;
    const ok = await onChange(draft);
    if (ok !== false) setDraft(null);
  };
  const changed = targets.filter((t) => t.custom).length;
  // One short line under the number: where the number came from.
  const sub = target
    ? target.custom ? "Just this comic" : "Same as everyone"
    : allMinutes !== null ? "Set by the hosts tonight" : hasOverrides && changed > 0 ? `Sheet says ${fallback} min · ${changed} ${changed === 1 ? "comic" : "comics"} changed` : hasOverrides ? "From the sheet, some changed" : "From the sheet";
  const resetLabel = target ? (target.custom ? "Same as everyone" : null) : hasOverrides ? "Reset everyone to the sheet" : null;
  const pick = (key: string) => {
    setDraft(null);
    onSelect(key);
    setOpen(false);
  };
  const rowClass = (on: boolean) =>
    "flex min-h-14 w-full items-center gap-3 border-b border-white/10 px-4 py-3 text-left text-[18px] font-semibold transition active:bg-white/10 " + (on ? "bg-sky-400/15 text-white" : "text-white/90");
  const step = "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/10 text-3xl font-bold text-white transition active:scale-95 disabled:opacity-30";
  const label = "text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50";
  return (
    <section aria-label="Set length for the comics" className="relative mt-5 rounded-3xl bg-[#16161a] px-4 pb-4 pt-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <p className={label}>Who</p>
      <div className="mt-2">
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
          className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-left outline-none transition active:bg-black/50 disabled:opacity-40"
        >
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-400/20 text-[15px] font-bold text-sky-300">
            {target ? target.name.trim().charAt(0).toUpperCase() : <Users className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[18px] font-semibold leading-tight text-white">{target ? target.name : "Everyone"}</span>
            <span className="block truncate text-[13px] text-white/50">{target ? "Tap to pick someone else" : "Tap to pick one comic instead"}</span>
          </span>
          <ChevronDown className={"h-6 w-6 shrink-0 text-white/50 transition " + (open ? "rotate-180" : "")} aria-hidden="true" />
        </button>
        {open && (
          <ul role="listbox" aria-label="Who the set length is for" className="mt-2 max-h-72 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-black/40">
            <li role="option" aria-selected={!target}>
              <button type="button" onClick={() => pick("")} className={rowClass(!target)}>
                <span className="min-w-0 flex-1 break-words">Everyone</span>
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
      <p className={label + " mt-5"}>Set length</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <button type="button" aria-label="One minute less" disabled={saving || shown <= MIN_COMIC_MINUTES} onClick={() => setDraft(shown - 1)} className={step}>
          −
        </button>
        <span className="text-center text-6xl font-bold leading-none tabular-nums text-white">
          {shown}
          <span className="ml-1.5 text-xl font-normal text-white/50">min</span>
        </span>
        <button type="button" aria-label="One minute more" disabled={saving || shown >= MAX_COMIC_MINUTES} onClick={() => setDraft(shown + 1)} className={step}>
          +
        </button>
      </div>
      <p className="mt-3 text-center text-[13px] text-white/50">{sub}</p>
      <div role="group" aria-label="Quick lengths" className="mt-4 flex gap-2">
        {QUICK_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            disabled={saving}
            aria-pressed={shown === m}
            onClick={() => setDraft(m)}
            className={"h-11 flex-1 rounded-xl border text-[16px] font-semibold transition active:scale-95 disabled:opacity-40 " + (shown === m ? "border-sky-400 bg-sky-900 text-white" : "border-white/10 text-white/80")}
          >
            {m}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={saving || !dirty}
        onClick={() => void save()}
        className={"mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl px-4 py-2 text-center text-[18px] font-semibold transition active:scale-[0.98] " + (dirty ? "bg-sky-400 text-sky-950" : "bg-white/10 text-white/40")}
      >
        {dirty ? `Set ${forName} to ${shown} min` : "No change yet"}
      </button>
      {resetLabel && (
        <button
          type="button"
          disabled={saving}
          onClick={() => { setDraft(null); void onChange(null); }}
          className="mt-2 flex h-11 w-full items-center justify-center text-[14px] font-medium text-white/60 active:text-white disabled:opacity-40"
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
