"use client";

import { useEffect, useState } from "react";

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
        "mt-4 flex h-12 w-full items-center justify-center rounded-2xl border-2 text-[13px] font-black uppercase tracking-[0.15em] transition active:scale-[0.99] disabled:opacity-40 " +
        (armed ? "border-transparent bg-white text-black" : "border-white/25 bg-[#1f1f24] text-white/80")
      }
    >
      {armed ? "Tap again to restart" : "Restart the show"}
    </button>
  );
}
