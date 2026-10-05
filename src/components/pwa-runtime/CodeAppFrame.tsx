"use client";

import { useEffect, useRef } from "react";

const PREFIX = "tlapp:";
const MAX_VALUE = 100_000;

/**
 * A published AI-written app: its sandboxed frame, the Report link (outside the app's own code, so it can't be
 * hidden), and the keeper of the app's sign-in. The sandboxed app can't store anything itself, so it asks this page
 * (see the runtime's storage bridge). Each app has its own address, so its storage is its own.
 */
export function CodeAppFrame({ name }: { name: string }) {
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data as { source?: string; type?: string; op?: string; key?: unknown; value?: unknown; id?: unknown } | null;
      if (e.source !== frame.current?.contentWindow || !d || d.source !== "tl-app" || d.type !== "storage") return;
      if (typeof d.key !== "string" || d.key.length > 200 || typeof d.id !== "string") return;
      let value: string | null = null;
      try {
        const key = PREFIX + d.key;
        if (d.op === "get") value = localStorage.getItem(key);
        else if (d.op === "set" && typeof d.value === "string" && d.value.length <= MAX_VALUE) localStorage.setItem(key, d.value);
        else if (d.op === "remove") localStorage.removeItem(key);
      } catch {
        // Storage blocked (private mode): the app keeps the sign-in in memory instead.
      }
      frame.current?.contentWindow?.postMessage({ source: "tl-host", type: "storage-reply", id: d.id, value }, "*");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <>
      <iframe ref={frame} title={name} src="/app-code" sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads" className="fixed inset-0 h-full w-full border-0 bg-white" />
      {/* Outside the app's own (sandboxed) code, so an app can't hide it. Small, but a full 44pt to tap. */}
      <a href="/report" className="fixed bottom-1 left-1 z-10 inline-flex min-h-11 items-center p-1.5" aria-label={`Report ${name} to TapAndLaunch`}>
        <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur hover:bg-black/70">Report</span>
      </a>
    </>
  );
}
