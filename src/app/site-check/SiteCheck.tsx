"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Search } from "lucide-react";
import { counterLabel, initialState, reduce, type ReduceEvent, type SiteCheckState } from "./lib/reducer";
import { eventType, parseSseBlock } from "./lib/sse";
import { Checked } from "./Checked";
import { CrawlMap } from "./CrawlMap";
import { Log } from "./Log";
import { Result } from "./Result";
import { ScorePanel } from "./ScorePanel";
import { Stages } from "./Stages";
import "./site-check.css";

const PANEL = "rounded-xl border border-neutral-200 bg-white p-4";
const PANEL_TITLE = "mb-3 text-sm font-medium uppercase tracking-[0.06em] text-neutral-500";

/** The address field and Run button, then the live panels, driven entirely by the streamed audit events. */
export function SiteCheck({ initialUrl }: { initialUrl: string }) {
  const [state, dispatch] = useReducer(
    (s: SiteCheckState, event?: ReduceEvent): SiteCheckState => (event === undefined ? s : reduce(s, event)),
    undefined,
    initialState
  );
  const [url, setUrl] = useState(initialUrl);
  const runSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const running = state.phase === "running";

  // Leaving the page ends the run: aborting the fetch aborts the request, which stops the server too.
  useEffect(() => () => abortRef.current?.abort(), []);

  // A shared link (/site-check?q=…) starts its check at once, like the domains page does. The start waits one tick so that
  // React's development double-mount cancels the first timer instead of aborting a request the server has already counted.
  useEffect(() => {
    const addr = initialUrl.trim();
    if (!addr) return;
    const timer = setTimeout(() => void run(addr), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only for the address the page loaded with
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const addr = url.trim();
    if (!addr) return;
    window.history.replaceState(null, "", `/site-check?q=${encodeURIComponent(addr)}`);
    void run(addr);
  }

  async function run(addr: string) {
    const seq = ++runSeq.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "reset" });

    try {
      const res = await fetch(`/api/site-check?url=${encodeURIComponent(addr)}`, {
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        if (seq !== runSeq.current) return;
        const message = typeof body.error === "string" && body.error ? body.error : `Server said ${res.status}.`;
        dispatch({ type: "blocked", message });
        return;
      }
      if (seq !== runSeq.current) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const parsed = parseSseBlock(chunk);
          if (!parsed) continue;
          const type = eventType(parsed.name, parsed.data);
          if (seq !== runSeq.current) return;
          dispatch({ type, ...(parsed.data as Record<string, unknown>) } as unknown as ReduceEvent);
        }
        if (seq !== runSeq.current) return;
      }
    } catch (err) {
      if (seq !== runSeq.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      dispatch({ type: "error", message: "Lost the connection. Run it again." });
    }
  }

  const selectedPage = state.nodes.find((n) => n.url === state.selectedUrl)?.page ?? null;

  return (
    <section aria-label="Check your website" className="mt-10">
      <form onSubmit={handleSubmit} autoComplete="off" spellCheck={false} className="flex max-w-3xl flex-col gap-3 sm:flex-row">
        <label htmlFor="site-check-url" className="sr-only">
          Website address
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <input
            id="site-check-url"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={200}
            placeholder="https://yoursite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={running}
            className="h-14 w-full rounded-full border border-neutral-300 bg-white pl-13 pr-5 text-lg text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/10 disabled:opacity-60"
            style={{ paddingLeft: "3.25rem" }}
          />
        </div>
        <button
          type="submit"
          disabled={running || !url.trim()}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-neutral-950 px-7 text-base font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {running ? "Checking…" : "Run"}
        </button>
      </form>

      {state.routeError ? (
        <p role="alert" className="mt-6 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.routeError}
        </p>
      ) : (
        <>
          {state.cachedMinutesAgo != null && (
            <p className="mt-6 text-sm text-neutral-500">
              {state.cachedMinutesAgo >= 1
                ? `Checked ${state.cachedMinutesAgo} minutes ago; here is that result.`
                : "Checked moments ago; here is that result."}
            </p>
          )}

          <div className="sc-grid mt-6">
            <section aria-label="What it's doing" className={`sc-area-stages ${PANEL}`}>
              <h2 className={PANEL_TITLE}>What it&rsquo;s doing</h2>
              <Stages stages={state.stages} />
            </section>

            <section aria-label="The crawl" className={`sc-area-crawl ${PANEL}`}>
              <h2 className={PANEL_TITLE}>The crawl</h2>
              <CrawlMap
                nodes={state.nodes}
                edges={state.edges}
                selectedUrl={state.selectedUrl}
                onSelect={(u) => dispatch({ type: "select", url: u })}
                counter={counterLabel(state)}
              />
            </section>

            <section aria-label="What it checked" className={`sc-area-checked ${PANEL}`}>
              <h2 className={PANEL_TITLE}>What it checked</h2>
              <Checked page={selectedPage} titleLimits={state.titleLimits} descriptionLimits={state.descriptionLimits} />
            </section>

            <section aria-label="Live log" className={`sc-area-log ${PANEL}`}>
              <h2 className={PANEL_TITLE}>Live log</h2>
              <Log lines={state.log} />
            </section>

            <section aria-label="How the score is built" className={`sc-area-score ${PANEL}`}>
              <h2 className={PANEL_TITLE}>How the score is built</h2>
              <ScorePanel score={state.score} />
            </section>
          </div>

          <Result done={state.done} runError={state.runError} />
        </>
      )}
    </section>
  );
}
