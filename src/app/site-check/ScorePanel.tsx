"use client";

import { useEffect, useState } from "react";
import type { ScoreEvent } from "seositetuneup";

const RULE =
  "Each page starts at 100; an error costs 12, a warning 4, a notice 1, each problem once per page. The site score is the average of the pages minus the site-wide problems.";
const ARC = Math.PI * 50; // length of the half-circle gauge path, radius 50

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The half-circle gauge, counting up to the final score with its grade. */
function Gauge({ score, grade }: { score: number; grade: string }) {
  const target = ARC * (1 - score / 100);
  const [offset, setOffset] = useState(ARC);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reducedMotion()) {
      const raf = requestAnimationFrame(() => {
        setOffset(target);
        setShown(score);
      });
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setOffset(target));
    const start = performance.now();
    const dur = 800;
    let id = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(score * eased));
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(id);
    };
  }, [score, target]);

  return (
    <div className="relative mx-auto w-[180px]">
      <svg viewBox="0 0 120 72" aria-hidden="true" className="block w-[180px]">
        <path d="M10 62 A50 50 0 0 1 110 62" fill="none" stroke="#e3e7ef" strokeWidth="12" />
        <path
          d="M10 62 A50 50 0 0 1 110 62"
          fill="none"
          stroke="#2b5fd9"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={ARC}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-x-0 top-[30%] flex flex-col items-center">
        <span className="text-3xl font-bold">{shown}</span>
        <span className="text-xl font-bold text-blue-600">{grade}</span>
      </div>
    </div>
  );
}

/** "How the score is built": the rule in words, the pages counted and average, each penalty, then the gauge. */
export function ScorePanel({ score }: { score: ScoreEvent | null }) {
  return (
    <div>
      <p className="text-sm leading-relaxed text-neutral-500">{RULE}</p>
      <div className="mt-3 flex gap-6">
        <div>
          <span className="block text-2xl font-bold">{score ? score.pagesCounted : "–"}</span>
          <span className="text-xs text-neutral-500">pages counted</span>
        </div>
        <div>
          <span className="block text-2xl font-bold">{score && score.pagesCounted ? Math.round(score.average) : "–"}</span>
          <span className="text-xs text-neutral-500">page average</span>
        </div>
      </div>
      <ul className="mb-3 mt-2">
        {score?.penalties.map((p, i) => (
          <li key={i} className="flex gap-2 border-b border-dashed border-neutral-200 py-[5px] text-sm">
            <span className="shrink-0 font-bold text-red-500">−{p.points}</span>
            <span className="min-w-0 break-words">{p.message}</span>
          </li>
        ))}
      </ul>
      {score ? <Gauge score={score.score} grade={score.grade} /> : <p className="text-sm text-neutral-500">Run a check to build the score.</p>}
    </div>
  );
}
