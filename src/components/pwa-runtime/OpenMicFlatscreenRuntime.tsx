"use client";

import { useEffect, useState } from "react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { showDateFor } from "@/lib/openmic/window";
import { spotlightIndex, useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { formatCountdown } from "@/lib/openmic/tv-timer";
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
  const { feed } = useLineup(config.lineup_url, client, undefined, true);
  const { spotlight } = useSpotlight(client);
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

/** The corner box itself, pure so it can be rendered in a test. Running: the live countdown and bar. Not running: the
 *  next comic and their set length, still. */
export function TvTimerPanel({ name, ms, totalMs, running }: { name: string; ms: number; totalMs: number; running: boolean }) {
  const over = running && ms < 0;
  const progress = running ? Math.max(0, Math.min(100, 100 * (1 - ms / totalMs))) : 0;
  return (
    <div className="relative flex w-[34rem] shrink-0 items-end p-8">
      <div className={`w-full rounded-3xl p-8 ring-1 ${over ? "bg-red-950/90 ring-red-500/60" : "bg-black/80 ring-white/20"}`}>
        <p className="text-xl font-semibold uppercase tracking-[0.3em] text-white/60">{running ? "Performing" : "On deck"}</p>
        <p className="mt-1 truncate text-5xl font-bold">{name}</p>
        <p className={`mt-2 text-7xl font-bold tabular-nums ${over ? "text-red-500" : running ? "text-white" : "text-white/60"}`}>{formatCountdown(ms)}</p>
        {running ? (
          <div className="mt-4 h-3 w-full rounded-full bg-white/15">
            <div className={`h-3 rounded-full ${over ? "bg-red-500" : "bg-white"}`} style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
