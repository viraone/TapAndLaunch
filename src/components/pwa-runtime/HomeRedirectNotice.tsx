"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isInstalledApp } from "@/lib/pwa/home-redirect";
import { readNavFlag, subscribeNavFlags } from "@/lib/pwa/nav-flags";
import type { HomeRedirectNotice as Notice } from "@/types/database";

/** The id of the <style> the pre-draw script adds to hide the page (lib/pwa/home-redirect.ts). */
const HIDE_STYLE_ID = "tl-home-redirect";
const DEFAULT_SECONDS = 10;

/**
 * What a visitor sees on the home page while `theme.home_redirect` has a notice: the page's own content is hidden
 * (the pre-draw script in lib/pwa/home-redirect.ts adds a <style> to <head>), this card shows the notice,
 * and after `seconds` (or the button) the browser goes to `target`. A browser whose tab switch (`unlessFlag`, e.g.
 * StageTime's hosts) is on gets its page back and never sees this. StageTime: "Halloween Costume Contest this week"
 * on the way to stagetimepnw.com/halloween.
 */
export function HomeRedirectNotice({ target, unlessFlag, notice }: { target: string; unlessFlag?: string; notice: Notice }) {
  // null on the server and before hydration (nothing drawn yet), then the browser's own switch. An installed copy
  // (Home Screen app) keeps its page like a host does, for the same reason as in lib/pwa/home-redirect.ts.
  const host = useSyncExternalStore(
    subscribeNavFlags,
    () => isInstalledApp() || (!!unlessFlag && readNavFlag(unlessFlag)),
    () => null
  );
  const seconds = Math.max(1, Math.round(notice.seconds ?? DEFAULT_SECONDS));
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (host) document.getElementById(HIDE_STYLE_ID)?.remove();
  }, [host]);

  useEffect(() => {
    if (host !== false) return;
    if (left <= 0) {
      window.location.replace(target);
      return;
    }
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [host, left, target]);

  if (host !== false) return null;

  return (
    <div
      className="tl-home-redirect-notice fixed inset-0 z-[100] overflow-y-auto bg-[#09090b] px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8 text-zinc-100"
      role="dialog"
      aria-labelledby="tl-home-redirect-title"
    >
      <div className="mx-auto max-w-md rounded-2xl border border-orange-500/40 bg-zinc-900 p-6 shadow-[0_0_40px_rgba(249,115,22,0.18)]">
        <h1 id="tl-home-redirect-title" className="text-2xl font-bold leading-tight text-orange-400">
          {notice.title ?? "This week is different"}
        </h1>
        {notice.text && <p className="mt-3 text-base leading-relaxed text-zinc-200">{notice.text}</p>}
        <a
          href={target}
          className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-center text-base font-semibold text-black active:bg-orange-400"
        >
          {notice.button ?? "Continue"}
        </a>
        <p className="mt-3 text-center text-sm text-zinc-400" aria-live="polite">
          Taking you there in {left} {left === 1 ? "second" : "seconds"}…
        </p>
      </div>
    </div>
  );
}
