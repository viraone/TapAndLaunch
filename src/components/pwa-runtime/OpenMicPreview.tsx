"use client";

import { useEffect, useState } from "react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import type { LineupFeed, ShowDayState } from "@/lib/openmic/selection";
import { formatShowDate, formatWeekTime, isShowDay, reopenLabel, showDateFor } from "@/lib/openmic/window";
import { ClosedSignedOut, ShowDay, SignupHeader, windowOf } from "./OpenMicSignupRuntime";

/**
 * Local development only (see the PREVIEW_ENABLED switch in OpenMicSignupRuntime):
 * /signup?preview=<kind> shows a show-day screen with a made-up status for a
 * made-up comic, next to the real lineup. It proves how each screen looks and
 * reads. It does not prove the real connections (a real request plus a match
 * in the sheet); that is what the final test round is for.
 */

const KINDS = [
  { id: "selected", label: "Selected" },
  { id: "not-selected", label: "Not selected" },
  { id: "no-request", label: "Didn't request" },
  { id: "pending", label: "Not posted yet" },
  { id: "closed-night", label: "Thursday night" },
  { id: "signed-out", label: "Signed out" },
] as const;
type Kind = (typeof KINDS)[number]["id"];

const isKind = (k: string): k is Kind => KINDS.some((x) => x.id === k);

/** The coming Friday in the show's time zone, as year / month / day. */
function upcomingFriday(timeZone: string): { y: number; m: number; d: number } {
  for (let i = 0; i < 8; i++) {
    const at = new Date(Date.now() + i * 86_400_000);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", year: "numeric", month: "numeric", day: "numeric" })
        .formatToParts(at)
        .map((p) => [p.type, p.value])
    );
    if (parts.weekday === "Fri") return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
  }
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}

const DISMISS_KEY = "openmic-preview-dismissed";

export default function OpenMicPreview({ kind, config }: { kind: string; config: OpenMicSignupBlockConfig }) {
  const window_ = windowOf(config);
  const valid = isKind(kind) ? kind : null;
  const nightBefore = valid === "closed-night";
  const friday = upcomingFriday(window_.timeZone);
  // Friday ~3 PM, or the night before at ~11:30 PM, in Seattle (both inside the closed window).
  const now = new Date(nightBefore ? Date.UTC(friday.y, friday.m - 1, friday.d, 6, 30) : Date.UTC(friday.y, friday.m - 1, friday.d, 22, 0));
  const lineupTime = !nightBefore;
  const signedIn = valid !== "signed-out";

  const [real, setReal] = useState<LineupFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const wantsList = valid && lineupTime && valid !== "signed-out";
  useEffect(() => {
    if (!wantsList || !config.lineup_url) return;
    let cancelled = false;
    fetch(config.lineup_url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: LineupFeed) => !cancelled && setReal(j))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [wantsList, config.lineup_url]);

  const feed: LineupFeed | null = real
    ? valid === "pending"
      ? { ...real, posted: false, lineup: [], me: { selected: false, set_length: "", start_time: "" } }
      : { ...real, me: { selected: valid === "selected", set_length: "", start_time: "" } }
    : null;

  const state: ShowDayState =
    valid === "selected"
      ? "selected"
      : valid === "not-selected"
        ? "not-selected"
        : valid === "no-request"
          ? "no-request"
          : valid === "pending"
            ? "selections-pending"
            : valid === "closed-night"
              ? "closed-night"
              : "signed-out";

  function showCardAgain() {
    try {
      window.localStorage.removeItem(`${DISMISS_KEY}:${kind}`);
    } catch {
      // ignore
    }
    window.location.reload();
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
      <div className="mb-6 rounded-2xl border-2 border-dashed border-sky-400/60 bg-sky-400/10 p-4 text-sm">
        <p className="font-bold text-sky-300">PREVIEW · local only</p>
        <p className="mt-1 text-muted-foreground">Made-up comic and status, real lineup from this week&apos;s sheet. Nothing is saved or sent.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <a
              key={k.id}
              href={`?preview=${k.id}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                k.id === valid ? "bg-sky-400 text-sky-950 ring-sky-400" : "bg-background text-foreground ring-border hover:bg-foreground/10"
              }`}
            >
              {k.label}
            </a>
          ))}
        </div>
        {valid === "selected" && (
          <button type="button" onClick={showCardAgain} className="mt-3 text-xs font-semibold text-sky-300 underline underline-offset-4">
            Bring the green card back (after tapping ✕)
          </button>
        )}
        {!valid && <p className="mt-3 font-semibold text-foreground">Pick one of the screens above.</p>}
      </div>

      {valid && (
        <>
          <SignupHeader
            config={config}
            showDate={formatShowDate(showDateFor(window_, now))}
            open={false}
            hidePill={signedIn && lineupTime}
            reopenText={reopenLabel(window_, now)}
            closesAt={formatWeekTime(window_.closesWeekday, window_.closesMinutes)}
          />
          {signedIn && (
            <div className="mt-5 rounded-xl bg-muted/70 px-4 py-3 text-sm">
              <p className="truncate text-muted-foreground">
                Signed in as <span className="font-semibold text-foreground">Lori Peck</span>
              </p>
            </div>
          )}
          <div className="mt-6">
            {valid === "signed-out" ? (
              <ClosedSignedOut today={isShowDay(window_, now)} onSignIn={() => undefined} />
            ) : (
              <ShowDay
                state={state}
                feed={feed}
                failed={failed}
                config={config}
                dateLabel={formatShowDate(showDateFor(window_, now))}
                today={isShowDay(window_, now)}
                lineupTime={lineupTime}
                dismissKey={`${DISMISS_KEY}:${kind}`}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
