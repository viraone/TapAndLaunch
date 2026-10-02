"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, PartyPopper } from "lucide-react";
import type { Checklist, ChecklistStepId } from "@/lib/apps/checklist";

/**
 * "Get live": where the app stands and the one thing to do next. The next
 * step carries its own button; finished steps tick themselves off.
 */
export function GetLiveChecklist({
  checklist,
  liveUrl,
  busy,
  onAction,
}: {
  checklist: Checklist;
  /** The published address, shown once the app is live. */
  liveUrl: string | null;
  /** True while publishing, so the Publish button can't be tapped twice. */
  busy?: boolean;
  onAction: (step: ChecklistStepId) => void;
}) {
  const [copied, setCopied] = useState(false);
  const pct = Math.round((checklist.doneCount / checklist.total) * 100);

  async function copy() {
    if (!liveUrl) return;
    try {
      await navigator.clipboard.writeText(new URL(liveUrl, window.location.href).href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the address is shown as text anyway.
    }
  }

  if (checklist.complete) {
    return (
      <section className="rounded-3xl bg-gradient-to-br from-emerald-400/15 to-emerald-400/[0.03] p-4 ring-1 ring-emerald-400/30">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-400 text-emerald-950">
            <PartyPopper className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-50">You&apos;re live</p>
            <p className="text-xs text-emerald-200/80">Share your link and watch the views come in.</p>
          </div>
        </div>
        {liveUrl && (
          <button
            type="button"
            onClick={copy}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2.5 text-left text-xs text-neutral-200 transition hover:bg-black/50"
          >
            <span className="truncate font-medium">{liveUrl.replace(/^(https?:)?\/\//, "")}</span>
            {copied ? <Check className="h-4 w-4 shrink-0 text-emerald-300" /> : <Copy className="h-4 w-4 shrink-0 text-neutral-400" />}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-50">Get live</p>
        <p className="text-xs tabular-nums text-neutral-400">
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
                <span className={`text-[13px] ${step.done ? "text-neutral-500 line-through decoration-white/20" : "font-medium text-neutral-100"}`}>
                  {step.title}
                </span>
                <span className="sr-only">{step.done ? "Done" : isNext ? "Next" : "To do"}</span>
              </div>
              {isNext && (
                <div className="mt-2 pl-8">
                  <p className="text-xs leading-relaxed text-neutral-400">{step.hint}</p>
                  <button
                    type="button"
                    disabled={busy && step.id === "publish"}
                    onClick={() => onAction(step.id)}
                    className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-neutral-950 transition hover:bg-indigo-50 disabled:opacity-60"
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
