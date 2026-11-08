"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/lib/format-date";

/** The live Seattle time, shown above the signed-in person's avatar in the app header. Renders nothing until mounted. */
export function HeaderClock() {
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
  if (!time) return null;
  return <p className="text-[15px] font-black tabular-nums leading-none tracking-tight">{time}</p>;
}
