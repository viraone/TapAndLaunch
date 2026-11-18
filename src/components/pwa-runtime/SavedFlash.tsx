"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";

/** A small card in the middle of the screen that says something was saved, then goes away by itself. It never blocks taps. */
export function SavedFlash({ message, onDone, ms = 2200 }: { message: string; onDone: () => void; ms?: number }) {
  useEffect(() => {
    const id = setTimeout(onDone, ms);
    return () => clearTimeout(id);
  }, [message, onDone, ms]);
  return (
    <div role="status" aria-live="assertive" className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center px-6">
      <div className="flex w-full max-w-48 flex-col items-center gap-2 rounded-2xl bg-emerald-500 px-3 py-4 text-center shadow-[0_0_30px_rgba(16,185,129,0.6)] ring-2 ring-white/90">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600">
          <Check className="h-6 w-6" strokeWidth={4} aria-hidden="true" />
        </span>
        <p className="text-balance text-[15px] font-black leading-tight text-white">{message}</p>
      </div>
    </div>
  );
}
