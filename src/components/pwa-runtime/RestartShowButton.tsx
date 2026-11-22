"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";

/** Admin-only, lives in the host Timer tab: two taps clear the show clock and every finished set. */
export function RestartShowButton({ busy, onRestart }: { busy: boolean; onRestart: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onRestart();
      }}
      className={
        "mt-2 flex min-h-[4.5rem] w-full items-center gap-2 rounded-2xl border px-3 py-3 text-left outline-none transition disabled:opacity-40 " +
        (armed ? "border-white bg-white" : "border-sky-400/70 bg-sky-400/[0.12] active:bg-sky-400/25")
      }
    >
      <span aria-hidden="true" className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full " + (armed ? "bg-black/10 text-black" : "bg-sky-400/25 text-sky-300")}>
        <RotateCcw className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={"block break-words text-[24px] font-bold leading-tight " + (armed ? "text-black" : "text-white")}>{armed ? "Tap again to restart" : "Restart the show"}</span>
        <span className={"block break-words text-[17px] font-semibold leading-snug " + (armed ? "text-black/70" : "text-sky-300")}>{armed ? "Clears the timer and checks" : "Tap twice to start over"}</span>
      </span>
    </button>
  );
}
