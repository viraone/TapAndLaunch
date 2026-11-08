"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format-date";
import { useSignedInName } from "@/lib/openmic/signed-in-name";

/** The live Seattle time, shown under the app title in the app header. Renders nothing until mounted. */
export function HeaderClock({ requireSignIn = false, className = "text-[15px] font-black tabular-nums leading-none tracking-tight" }: { requireSignIn?: boolean; className?: string }) {
  const name = useSignedInName();
  const [time, setTime] = useState<string | null>(null);
  const last = useRef<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const next = formatClock(new Date(), "America/Los_Angeles");
      if (next === last.current) return;
      last.current = next;
      setTime(next);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!time || (requireSignIn && !name)) return null;
  return <p className={className}>{time}</p>;
}
