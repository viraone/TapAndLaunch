"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import type { LineupFeed } from "@/lib/openmic/selection";
import { formatShowDate, isLineupTime, isShowDay, showDateFor, type WeeklyWindow } from "@/lib/openmic/window";
import { spotlightIndex, useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { useLineup, useNow, useOpenMicClient, windowOf } from "./OpenMicSignupRuntime";

/**
 * The show-night lineup for a screen at the venue (block view "lineup", its own page, e.g. /lineup). A full-screen
 * website page, not the phone column: it covers the app's header and tab bar, fills a laptop or TV, and lists
 * the lineup from the host's sheet (via `lineup_url`) in type that reads from across the room. On show day from
 * 6 AM until requests reopen it shows the list, with the comic the hosts have highlighted from the Remote tab
 * (the lineup spotlight) in a solid row; the rest of the week it just names the next show. Refreshes from the
 * sheet every minute and follows the highlight over realtime.
 */

// Local development only: /lineup?preview=1 shows the page as if it were Friday 7:30 PM, mid-show.
const PREVIEW_ENABLED = process.env.NODE_ENV !== "production";
const noopSubscribe = () => () => {};
const readPreview = () => (PREVIEW_ENABLED ? new URLSearchParams(window.location.search).has("preview") : false);

/** The coming Friday (or the show's weekday) at 7:30 PM in the show's time zone, for the preview. */
function previewNow(w: WeeklyWindow): Date {
  for (let i = 0; i < 8; i++) {
    const at = new Date(Date.now() + i * 86_400_000);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: w.timeZone, weekday: "short", year: "numeric", month: "numeric", day: "numeric" })
        .formatToParts(at)
        .map((p) => [p.type, p.value])
    );
    if (["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday) === w.showWeekday) {
      // 7:30 PM Pacific is 2:30 AM UTC the next day (PDT); an hour off in winter is fine for a preview.
      return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1, 2, 30));
    }
  }
  return new Date();
}

function clockLabel(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(now);
}

export function OpenMicLineupRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  const client = useOpenMicClient(config);
  const window_ = windowOf(config);
  const realNow = useNow();
  const preview = useSyncExternalStore(noopSubscribe, readPreview, () => false);
  const now = useMemo(() => (preview ? previewNow(window_) : realNow), [preview, realNow, window_]);
  const lineupTime = isLineupTime(window_, now);

  if (!client) {
    return (
      <p className="mx-4 my-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        The lineup isn&apos;t connected yet.
      </p>
    );
  }
  return <LineupPage client={client} config={config} window_={window_} now={now} lineupTime={lineupTime} preview={preview} />;
}

function LineupPage({
  client,
  config,
  window_,
  now,
  lineupTime,
  preview,
}: {
  client: NonNullable<ReturnType<typeof useOpenMicClient>>;
  config: OpenMicSignupBlockConfig;
  window_: WeeklyWindow;
  now: Date;
  lineupTime: boolean;
  preview: boolean;
}) {
  const { feed, failed } = useLineup(config.lineup_url, client, undefined, lineupTime);
  const { spotlight } = useSpotlight(client);
  const showDate = showDateFor(window_, now);
  const dateLabel = formatShowDate(showDate);
  const today = isShowDay(window_, now);
  const highlighted = feed ? spotlightIndex(spotlight, feed.lineup, ymd(showDate)) : -1;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-background text-foreground">
      <header className="flex items-center justify-between gap-6 border-b border-foreground/10 px-6 py-5 md:px-12">
        <div className="flex min-w-0 items-center gap-4">
          {config.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
            <img src={config.logo_url} alt={config.venue ?? ""} className="h-14 w-14 shrink-0 rounded-2xl bg-white object-cover ring-1 ring-white/10 md:h-20 md:w-20" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight md:text-4xl">{config.show_name ?? config.title ?? "Lineup"}</h1>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-primary md:text-sm">{today ? "Tonight" : "Next show"}</p>
          <p className="mt-1 whitespace-nowrap text-xl font-black tracking-tight md:text-3xl">{dateLabel}</p>
          <p className="mt-1 hidden text-base tabular-nums text-muted-foreground md:block" aria-label="Current time">
            {clockLabel(now, window_.timeZone)}
          </p>
        </div>
      </header>

      {preview && (
        <p className="bg-sky-400/15 px-6 py-2 text-center text-sm font-semibold text-sky-300 md:px-12">
          PREVIEW · local only · shown as if it were {dateLabel} at 7:30 PM, with the real lineup from the sheet
        </p>
      )}

      <main className="flex flex-1 flex-col px-6 py-8 md:px-12 md:py-10">
        {!lineupTime ? (
          <Notice title={`The lineup goes up ${today ? "today" : dateLabel.split(",")[0]} at 6 AM`} body="Check back then to see who's on." />
        ) : !feed && !failed ? (
          <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading the lineup">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : !feed ? (
          <Notice title="We couldn't load the lineup" body="Try again in a minute." />
        ) : !feed.posted || feed.lineup.length === 0 ? (
          <Notice title="We're putting the lineup together" body="Check back soon." />
        ) : (
          <LineupBoard feed={feed} today={today} weekday={dateLabel.split(",")[0]} highlighted={highlighted} />
        )}
      </main>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <h2 className="text-3xl font-black tracking-tight md:text-5xl">{title}</h2>
      <p className="mt-4 text-lg text-muted-foreground md:text-2xl">{body}</p>
    </div>
  );
}

/** The lineup in one column on a phone, two on a laptop or TV (read down the first, then the second), in big type.
 * The highlighted row (the hosts' spotlight) is solid in the show's colour, with no words: the comics know. */
function LineupBoard({ feed, today, weekday, highlighted }: { feed: LineupFeed; today: boolean; weekday: string; highlighted: number }) {
  const rows = feed.lineup.map((entry, i) => ({ entry, i }));
  const half = Math.ceil(rows.length / 2);
  const columns = rows.length > 8 ? [rows.slice(0, half), rows.slice(half)] : [rows];
  return (
    <section aria-label="Lineup" className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-primary md:text-2xl">{today ? "Tonight's lineup" : `${weekday}'s lineup`}</h2>
        <p className="text-base font-semibold tabular-nums text-muted-foreground md:text-xl">
          {feed.lineup.length} {feed.lineup.length === 1 ? "comic" : "comics"}
          {feed.lineup[0]?.start_time ? ` · first up ${feed.lineup[0].start_time}` : ""}
        </p>
      </div>
      <div className={`mt-6 grid gap-x-12 gap-y-0 ${columns.length === 2 ? "lg:grid-cols-2" : ""}`}>
        {columns.map((column, c) => (
          <ol key={c} className="min-w-0 divide-y divide-foreground/10 border-t border-foreground/10">
            {column.map(({ entry, i }) => {
              const on = i === highlighted;
              return (
                <li
                  key={`${entry.name}-${i}`}
                  aria-current={on ? "true" : undefined}
                  className={`flex items-center gap-3 py-3 md:gap-6 md:py-4 ${on ? "-mx-4 rounded-2xl bg-primary px-4 text-primary-foreground shadow-[0_0_0_4px_var(--primary)] md:-mx-6 md:px-6" : ""}`}
                >
                  <span className={`w-6 shrink-0 text-right text-base font-bold tabular-nums md:w-10 md:text-2xl ${on ? "opacity-80" : "text-muted-foreground"}`}>{i + 1}</span>
                  <span className={`min-w-0 flex-1 break-words text-xl leading-tight md:text-3xl 2xl:text-[2.25rem] ${on ? "font-black" : "font-bold"}`}>{entry.name}</span>
                  <span className={`w-12 shrink-0 text-right text-base tabular-nums md:w-20 md:text-2xl 2xl:text-3xl ${on ? "opacity-80" : "text-muted-foreground"}`}>{entry.set_length}</span>
                  <span className={`w-16 shrink-0 text-right text-base font-semibold tabular-nums md:w-28 md:text-2xl 2xl:text-3xl ${on ? "" : "text-primary"}`}>{entry.start_time}</span>
                </li>
              );
            })}
          </ol>
        ))}
      </div>
    </section>
  );
}
