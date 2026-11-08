"use client";

import { useEffect, useState } from "react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { showDateFor } from "@/lib/openmic/window";
import { useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { estimateStartTimes } from "@/lib/openmic/start-times";
import { formatCountdown, tvTimer, type TvTimer } from "@/lib/openmic/tv-timer";
import { useLineup, useOpenMicClient, windowOf } from "./OpenMicSignupRuntime";

/**
 * The show's flyer full screen for a flat-screen TV at the venue (block view "tv", its own page, e.g. /tv). A page
 * with a blurred copy of the flyer filling the background and the flyer kept whole, portrait or landscape, and nothing else but the timer box. The timer box in its own right-hand column reads
 * the same lineup, spotlight and estimates as the comics' phones and the hosts' Home.
 */
export function OpenMicFlatscreenRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  const client = useOpenMicClient(config);
  return (
    <div className="fixed inset-0 z-[100] flex overflow-hidden bg-black text-white">
      {config.flyer_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
        <img src={config.flyer_url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-3xl" />
      ) : null}
      <div className="relative flex min-w-0 flex-1 items-center justify-center">
        {config.flyer_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
          <img src={config.flyer_url} alt={`${config.show_name ?? "The show"} flyer`} className="h-full w-auto max-w-full object-contain" />
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
  const startLabels = estimateStartTimes({ lineup: feed.lineup, spotlight, showDate: showDay, timeZone: window_.timeZone, now });
  return <TvTimerPanel timer={tvTimer({ lineup: feed.lineup, spotlight, showDate: showDay, startLabels, now })} />;
}

/** The corner box itself, pure so it can be rendered in a test. */
export function TvTimerPanel({ timer }: { timer: TvTimer }) {
  const over = timer.kind === "on" && timer.remainingMs < 0;
  const progress = timer.kind === "on" ? Math.max(0, Math.min(100, 100 * (1 - timer.remainingMs / timer.totalMs))) : 0;
  return (
    <div className="relative flex w-[34rem] shrink-0 items-end p-8">
      <div className="w-full rounded-3xl bg-black/80 p-8 ring-1 ring-white/20">
      {timer.kind === "on" ? (
        <>
          <p className="text-xl font-semibold uppercase tracking-[0.3em] text-white/60">On stage</p>
          <p className="mt-1 truncate text-5xl font-bold">{timer.name}</p>
          <p className={`mt-2 text-7xl font-bold tabular-nums ${over ? "text-red-500" : "text-white"}`}>{formatCountdown(timer.remainingMs)}</p>
          <div className="mt-4 h-3 w-full rounded-full bg-white/15">
            <div className={`h-3 rounded-full ${over ? "bg-red-500" : "bg-white"}`} style={{ width: `${progress}%` }} />
          </div>
        </>
      ) : null}
      {timer.nextName ? (
        <div className={timer.kind === "on" ? "mt-6" : ""}>
          <p className="text-xl font-semibold uppercase tracking-[0.3em] text-white/60">Next up</p>
          <p className="mt-1 flex items-baseline justify-between gap-4">
            <span className="truncate text-3xl font-semibold">{timer.nextName}</span>
            {timer.nextAt ? <span className="shrink-0 text-3xl tabular-nums text-white/70">{timer.nextAt}</span> : null}
          </p>
        </div>
      ) : null}
      </div>
    </div>
  );
}
