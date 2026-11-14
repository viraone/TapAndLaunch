"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { showDateFor } from "@/lib/openmic/window";
import { spotlightIndex, useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { applyComicMinutes } from "@/lib/openmic/set-minutes";
import { formatCountdown, timerTone } from "@/lib/openmic/tv-timer";
import { anchorFresh, showClock } from "@/lib/openmic/show-clock";
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
          <img src={config.flyer_url} alt={`${config.show_name ?? "The show"} flyer`} className="h-full w-full object-contain object-center" />
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
  // No box before the first START (nothing to count yet), none after the last STOP, and none when the last START is hours old (a leftover from another day).
  if (spotlightIndex(spotlight, feed.lineup, showDay) === -1 || !anchorFresh(spotlight, now)) return null;
  const clock = showClock({ lineup: feed.lineup, spotlight, showDate: showDay, hostRow: config.host_row === true, now });
  if (clock.kind === "running") {
    return <TvTimerPanel name={feed.lineup[clock.index]!.name} next={feed.lineup[clock.index + 1]?.name} ms={clock.remainingMs} totalMs={clock.totalMs} running />;
  }
  if (clock.nextIndex === -1) return null;
  return <TvTimerPanel name={feed.lineup[clock.nextIndex]!.name} next={feed.lineup[clock.nextIndex + 1]?.name} ms={clock.nextMs} totalMs={clock.nextMs} running={false} />;
}

const TONE = {
  calm: { panel: "bg-[#0c0c0e] ring-1 ring-white/10", name: "text-white", digits: "text-white", next: "text-white", track: "bg-white/10", bar: "bg-primary", deck: "bg-white/[0.07]", tag: "bg-white text-black", deckName: "text-white", tick: "bg-white" },
  warn: { panel: "bg-amber-400", name: "text-amber-950", digits: "text-black", next: "text-amber-950/80", track: "bg-black/20", bar: "bg-black", deck: "bg-black/15", tag: "bg-black text-amber-400", deckName: "text-amber-950", tick: "bg-black/50" },
  urgent: { panel: "bg-amber-400", name: "text-amber-950", digits: "text-black", next: "text-amber-950/80", track: "bg-black/20", bar: "bg-black", deck: "bg-black/15", tag: "bg-black text-amber-400", deckName: "text-amber-950", tick: "bg-black/50" },
  over: { panel: "bg-red-600", name: "text-white", digits: "text-white", next: "text-white", track: "bg-black/25", bar: "bg-white", deck: "bg-black/20", tag: "bg-white text-red-700", deckName: "text-white", tick: "bg-white/60" },
} as const;

/** The corner box itself, pure so it can be rendered in a test. Not running: the next comic's name leads, with their set
 *  length as a pill and who follows. Running: the countdown fills the box; the whole box turns amber for the last 30
 *  seconds (the light) and solid red with white digits, counting up, past the set length. No words on amber or red: the colour says it.
 *  Sized for a comic reading it from the stage, across a bar. */
export function TvTimerPanel({ name, next, ms, totalMs, running }: { name: string; next?: string | null; ms: number; totalMs: number; running: boolean }) {
  if (!running) {
    return (
      <div className="relative flex w-[46rem] shrink-0 items-center p-3">
        <div className="w-full rounded-[2rem] bg-[#0c0c0e] p-10 ring-1 ring-white/10">
          <p className="text-3xl font-semibold uppercase tracking-[0.3em] text-primary">On deck</p>
          <p className="mt-6 line-clamp-2 break-words text-8xl font-black leading-[1.05]">{name}</p>
          <div className="mt-8 flex items-center gap-5">
            <span className="shrink-0 rounded-full bg-white px-7 py-2 text-4xl font-bold tabular-nums text-black">{`${Math.round(ms / 60000)} min`}</span>
            {next ? <span className="min-w-0 truncate text-3xl text-white/60">{`then ${next}`}</span> : null}
          </div>
        </div>
      </div>
    );
  }
  const tone = timerTone(ms);
  const t = TONE[tone];
  const left = tone === "over" ? 100 : Math.max(0, Math.min(100, (100 * ms) / totalMs));
  const ticks = tone === "over" ? [] : [60000, 30000].filter((at) => at < totalMs).map((at) => (100 * at) / totalMs);
  const digits = formatCountdown(ms);
  return (
    <div className="relative flex w-[46rem] shrink-0 items-center p-3">
      <div className={`relative w-full overflow-hidden rounded-[2rem] p-6 ${t.panel}`}>
        <div className="relative">
          <div className="flex h-12 items-center justify-between gap-6">
            {tone === "calm" ? (
              <p className="flex shrink-0 items-center gap-4 text-4xl font-semibold uppercase tracking-[0.2em] text-primary">
                <span className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-primary" />
                Performing
              </p>
            ) : (
              <span />
            )}
          </div>
          <p className={`mt-3 line-clamp-2 break-words text-8xl font-black leading-[1.02] ${t.name}`}>{name}</p>
          <p className={`mt-1 mb-1 font-black leading-none tabular-nums tracking-tight ${digits.length > 5 ? "text-[9rem]" : digits.length > 4 ? "text-[12rem]" : "text-[16rem]"} ${t.digits}`}>{digits}</p>
          <div className={`relative mt-0 h-8 w-full rounded-full ${t.track}`}>
            <div className={`h-8 rounded-full ${t.bar}`} style={{ width: `${left}%` }} />
            {ticks.map((pct) => (
              <span key={pct} className={`absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full ${t.tick}`} style={{ left: `${pct}%` }} />
            ))}
          </div>
          {next ? (
            <div className={`mt-6 flex items-center gap-6 rounded-3xl px-7 py-5 ${t.deck}`}>
              <span className={`shrink-0 rounded-full px-6 py-2 text-3xl font-black uppercase tracking-[0.25em] ${t.tag}`}>On deck</span>
              <p className={`min-w-0 line-clamp-2 break-words text-5xl font-extrabold leading-[1.05] ${t.deckName}`}>{next}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
