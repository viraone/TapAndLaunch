"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Loader2, Sparkles } from "lucide-react";
import type { Suggestion } from "@/lib/apps/suggestions";

/**
 * "Next up": the next thing worth fixing on this page, with one button that does it. The first suggestion is laid
 * out in full; the rest are a short list underneath. "Not now" hides one for this visit.
 */
export function NextUpCard({ suggestions, busy, onAction }: { suggestions: Suggestion[]; busy: string | null; onAction: (s: Suggestion) => void }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const list = suggestions.filter((s) => !dismissed.has(s.id));
  if (list.length === 0) return null;
  const [first, ...rest] = list;

  return (
    <section className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-base font-semibold text-neutral-50">
          <Sparkles className="h-4 w-4 text-fuchsia-300" /> Next up
        </p>
        <p className="text-sm tabular-nums text-neutral-300">{list.length === 1 ? "1 thing" : `${list.length} things`}</p>
      </div>
      <div className="mt-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
        <p className="text-sm font-medium text-neutral-100">{first.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-300">{first.detail}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <ActionButton s={first} busy={busy} onAction={onAction} />
          <button type="button" onClick={() => setDismissed((d) => new Set(d).add(first.id))} className="h-9 rounded-full px-3 text-sm text-neutral-300 transition hover:bg-white/10 hover:text-white">
            Not now
          </button>
        </div>
      </div>
      {rest.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="inline-flex items-center gap-1 px-1 py-1 text-sm text-neutral-300 transition hover:text-white">
            <ChevronDown className={`h-4 w-4 transition ${showAll ? "rotate-180" : ""}`} /> {showAll ? "Fewer" : `${rest.length} more`}
          </button>
          {showAll && (
            <ul className="mt-1 space-y-1">
              {rest.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.04]">
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-200" title={s.detail}>
                    {s.title}
                  </span>
                  <ActionButton s={s} busy={busy} onAction={onAction} small />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ActionButton({ s, busy, onAction, small }: { s: Suggestion; busy: string | null; onAction: (s: Suggestion) => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onAction(s)}
      disabled={!!busy}
      className={
        small
          ? "inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 text-sm font-medium text-neutral-100 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50"
          : "inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-50 disabled:opacity-60"
      }
    >
      {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : s.action.kind === "ai" ? <Sparkles className="h-3.5 w-3.5" /> : null}
      {busy === s.id ? "Working…" : s.action.label}
      {!small && busy !== s.id && s.action.kind !== "ai" && <ArrowRight className="h-3.5 w-3.5" />}
    </button>
  );
}
