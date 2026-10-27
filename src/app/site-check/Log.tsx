"use client";

import { useEffect, useRef } from "react";
import type { LogLine } from "./lib/reducer";

const STATUS_COLOR: Record<LogLine["status"], string> = {
  ok: "text-[#3fc377]",
  warn: "text-[#f0b429]",
  err: "text-[#f27979]",
};

/** The terminal-style list of requests, newest at the bottom, each entry one line with a horizontal scroll. */
export function Log({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      className="h-[260px] overflow-auto rounded-[10px] bg-[#0c0f15] p-2.5 font-mono text-xs leading-[1.6] text-[#d6dbe6]"
    >
      {lines.map((l, i) => (
        <div key={i} className="flex w-max min-w-full gap-2 whitespace-nowrap">
          <span className="shrink-0 text-[#6b7488]">{new Date(l.at).toLocaleTimeString()}</span>
          <span className={`w-[3.2em] shrink-0 ${STATUS_COLOR[l.status]}`}>{l.status}</span>
          {l.ms !== undefined && <span className="w-[4.5em] shrink-0 text-right text-[#6b7488]">{l.ms} ms</span>}
          <span className="shrink-0 break-all">{l.text}</span>
        </div>
      ))}
    </div>
  );
}
