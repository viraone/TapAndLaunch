"use client";

import { useEffect } from "react";

/**
 * Safari puts a page back where it was scrolled when it is refreshed. On a short page (the sign-up page) that left the
 * top of the banner under the status bar, which looked like a cut-off image. A refresh starts at the top instead;
 * going back or forward still restores the scroll position.
 */
export function ReloadToTop() {
  useEffect(() => {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (entry?.type !== "reload") return;
    const top = () => window.scrollTo(0, 0);
    top();
    const frame = requestAnimationFrame(top);
    const timer = window.setTimeout(top, 150);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
