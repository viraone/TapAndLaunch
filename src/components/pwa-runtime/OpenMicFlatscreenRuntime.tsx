"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { showDateFor } from "@/lib/openmic/window";
import { spotlightIndex, useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { applyComicMinutes } from "@/lib/openmic/set-minutes";
import { formatCountdown, timerTone } from "@/lib/openmic/tv-timer";
import { showClock } from "@/lib/openmic/show-clock";
import { useLineup, useOpenMicClient, windowOf } from "./OpenMicSignupRuntime";

/**
 * The show's flyer full screen for a flat-screen TV at the venue (block view "tv", its own page, e.g. /tv). A black
 * page where the flyer fills everything left of the timer column, cropped top and bottom when its shape does not fit, and nothing else. The timer box in its own right-hand column reads
 * the same lineup, spotlight and estimates as the comics' phones and the hosts' Home.
 */
export function OpenMicFlatscreenRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  const client = useOpenMicClient(config);
  return (
    <div className="fixed inset-0 z-[100] flex overflow-hidden bg-black text-white">
      <div className="relative flex min-w-0 flex-1 items-center justify-center">
        {config.flyer_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
          <img src={config.flyer_url} alt={`${config.show_name ?? "The show"} flyer`} className="h-full w-full object-cover object-center" />
        ) : (
          <p className="text-2xl font-semibold text-white/70">No flyer yet.</p>
        )}
      </div>
      {client ? <TvTimerBox client={client} config={config} /> : null}
    </div>
  );
}

/** A clock that ticks every second, for the countdown. */
function useSecond(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function TvTimerBox({ client, config }: { client: NonNullable<ReturnType<typeof useOpenMicClient>>; config: OpenMicSignupBlockConfig }) {
  const window_ = windowOf(config);
  const now = useSecond();
  const { feed: sheetFeed } = useLineup(config.lineup_url, client, undefined, true);
  const { spotlight } = useSpotlight(client);
  const feed = useMemo(() => applyComicMinutes(sheetFeed, spotlight, config.host_row === true), [sheetFeed, spotlight, config.host_row]);
  if (!feed || feed.lineup.length === 0) return null;
  const showDay = ymd(showDateFor(window_, now));
  // No box before the first START (nothing to count yet) and none after the last STOP.
  if (spotlightIndex(spotlight, feed.lineup, showDay) === -1) return null;
  const clock = showClock({ lineup: feed.lineup, spotlight, showDate: showDay, now });
  if (clock.kind === "running") {
    return <TvTimerPanel name={feed.lineup[clock.index]!.name} ms={clock.remainingMs} totalMs={clock.totalMs} running />;
  }
  if (clock.nextIndex === -1) return null;
  return <TvTimerPanel name={feed.lineup[clock.nextIndex]!.name} ms={clock.nextMs} totalMs={clock.nextMs} running={false} />;
}

const TONE = {
  calm: { panel: "bg-[#0c0c0e]", ring: "ring-1 ring-white/10", label: "text-primary", dot: "bg-primary", digits: "text-white", bar: "bg-primary", text: "Performing" },
  warn: { panel: "bg-[#0c0c0e]", ring: "ring-2 ring-amber-400/60", label: "text-amber-400", dot: "bg-amber-400", digits: "text-amber-400", bar: "bg-amber-400", text: "30 sec left" },
  urgent: { panel: "bg-[#0c0c0e]", ring: "ring-2 ring-red-500/70", label: "text-red-500", dot: "bg-red-500", digits: "text-red-500", bar: "bg-red-500", text: "Wrap up" },
  over: { panel: "bg-red-950/90", ring: "ring-2 ring-red-500", label: "text-red-500", dot: "bg-red-500", digits: "text-red-500", bar: "bg-red-500", text: "Over time" },
} as const;

/** The corner box itself, pure so it can be rendered in a test. Running: the live countdown and bar. Not running: the
 *  next comic and their set length, still. Sized for a comic reading it from the stage, across a bar. */
export function TvTimerPanel({ name, ms, totalMs, running }: { name: string; ms: number; totalMs: number; running: boolean }) {
  const t = TONE[running ? timerTone(ms) : "calm"];
  const progress = running ? Math.max(0, Math.min(100, 100 * (1 - ms / totalMs))) : 0;
  return (
    <div className="relative flex w-[44rem] shrink-0 items-center p-8">
      <div className={`w-full rounded-[2rem] p-10 ${t.panel} ${t.ring}`}>
        <p className={`flex items-center gap-5 text-3xl font-semibold uppercase tracking-[0.3em] ${running ? t.label : "text-white/60"}`}>
          {running ? <span className={`h-5 w-5 shrink-0 animate-pulse rounded-full ${t.dot}`} /> : null}
          {running ? t.text : "On deck"}
        </p>
        <p className="mt-2 truncate text-6xl font-bold leading-tight">{name}</p>
        <p className={`mt-4 text-[12rem] font-black leading-none tabular-nums tracking-tight ${running ? t.digits : "text-white/60"}`}>{formatCountdown(ms)}</p>
        {running ? (
          <div className="mt-8 h-3 w-full rounded-full bg-white/10">
            <div className={`h-3 rounded-full ${t.bar}`} style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
