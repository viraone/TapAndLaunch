import { CTA_BUTTON } from "@/components/marketing/MarketingChrome";
import type { SiteCheckDoneEvent } from "./lib/reducer";
import { severityBadge } from "./lib/stages";

const REPORT_PRICE_URL = "https://buy.stripe.com/6oU7sK590dpK5sDeY487K00";
const SECONDARY_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-100";

/** The result: the fix-first list in plain words, or the plain reason a site could not be checked, then the call to action. */
export function Result({ done, runError }: { done: SiteCheckDoneEvent | null; runError: string | null }) {
  if (!done && !runError) return null;

  if (runError) {
    return (
      <section aria-live="polite" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <h2 className="text-lg font-semibold">Stopped</h2>
        <p className="mt-2">{runError}</p>
      </section>
    );
  }

  const d = done as SiteCheckDoneEvent;
  return (
    <section aria-live="polite" className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Result</h2>
      {d.unreadable ? (
        <p className="mt-3 text-lg">{d.unreadable.message}</p>
      ) : (
        <>
          <p className="mt-2 text-neutral-500">Score {d.score} · grade {d.grade}</p>
          <h3 className="mt-4 font-semibold">Fix these first</h3>
          {d.fixFirst.length ? (
            <ul className="mt-3 flex flex-col gap-2.5">
              {d.fixFirst.map((f, i) => (
                <li key={i} className="rounded-[10px] border border-neutral-200 p-3">
                  <span className={severityBadge(f.severity)}>{f.severity}</span>
                  <span className="mt-1.5 block break-words font-bold">{f.what}</span>
                  <span className="block break-words">{f.why}</span>
                  <span className="mt-1 block break-words text-neutral-500">{f.how}</span>
                  <span className="mt-1 block text-sm text-neutral-500">
                    {f.pageCount} {f.pageCount === 1 ? "page" : "pages"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3">No problems to fix.</p>
          )}
          <div className="mt-4 flex flex-col items-start gap-3">
            <a href={REPORT_PRICE_URL} target="_blank" rel="noopener" className={CTA_BUTTON}>
              Get the full fix-first report, $149
            </a>
            <p className="text-sm text-neutral-500">A person checks every page, writes the plain-words report and the fix list, within two business days.</p>
            {d.reportUrl && (
              <a href={d.reportUrl} target="_blank" rel="noopener" className={SECONDARY_BUTTON}>
                Open the quick report
              </a>
            )}
          </div>
        </>
      )}
    </section>
  );
}
