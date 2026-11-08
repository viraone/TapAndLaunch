"use client";

import { useEffect, useState } from "react";

/** A clock that ticks every second, for the show countdown. */
export function useSecond(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
