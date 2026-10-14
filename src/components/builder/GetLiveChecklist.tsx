"use client";

import { ArrowRight, Check } from "lucide-react";
import type { Checklist, ChecklistStepId } from "@/lib/apps/checklist";

/**
 * "Get live": where the app stands and the one thing to do next. The next
 * step carries its own button; finished steps tick themselves off.
 */
export function GetLiveChecklist({
  checklist,
  busy,
  onAction,
}: {
  checklist: Checklist;
  /** True while publishing, so the Publish button can't be tapped twice. */
  busy?: boolean;
  onAction: (step: ChecklistStepId) => void;
}) {
  const pct = Math.round((checklist.doneCount / checklist.total) * 100);

  // Once every step is done the checklist has nothing to say: the live address is in the top bar.
  if (checklist.complete) return null;

  return (
    <section className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold text-neutral-50">Get live</p>
        <p className="text-sm tabular-nums text-neutral-300">
          {checklist.doneCount} of {checklist.total}
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Get live progress"
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-pink-400 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-4 space-y-1">
        {checklist.steps.map((step) => {
          const isNext = checklist.next?.id === step.id;
          return (
            <li key={step.id} className={isNext ? "rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10" : "px-1 py-1.5"}>
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    step.done ? "bg-emerald-400 text-emerald-950" : isNext ? "border-2 border-indigo-300" : "border border-white/20"
                  }`}
                  aria-hidden
                >
                  {step.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className={`text-sm ${step.done ? "text-neutral-400 line-through decoration-white/20" : "font-medium text-neutral-100"}`}>
                  {step.title}
                </span>
                <span className="sr-only">{step.done ? "Done" : isNext ? "Next" : "To do"}</span>
              </div>
              {isNext && (
                <div className="mt-2 pl-8">
                  <p className="text-sm leading-relaxed text-neutral-300">{step.hint}</p>
                  <button
                    type="button"
                    disabled={busy && step.id === "publish"}
                    onClick={() => onAction(step.id)}
                    className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-50 disabled:opacity-60"
                  >
                    {busy && step.id === "publish" ? "Publishing…" : step.action} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
