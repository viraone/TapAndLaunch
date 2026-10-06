"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dumbbell, Loader2, LocateFixed, MapPin, X } from "lucide-react";
import type { ClassFinderBlockConfig, FitnessClassType } from "@/types/database";
import {
  CLASS_TYPES,
  CLASS_TYPE_LABEL,
  classMinutes,
  hasStarted,
  milesBetween,
  partOfDay,
  seattleStamp,
  time12,
  type FitnessClass,
  type FitnessStudio,
  type PartOfDay,
} from "@/lib/fitness/schedule";

interface Week {
  days: string[];
  classes: FitnessClass[];
  studios: FitnessStudio[];
  readAt: string | null;
}

/**
 * One color per studio, told apart by hue (spread around the wheel, so neighbours in the list never look alike).
 * Assigned by the studio's place in a sorted list, so it is the same on every visit while the studios stay the same.
 */
function studioPalette(ids: string[]): Map<string, { stripe: string; text: string; textDark: string }> {
  return new Map(
    [...ids].sort().map((id, i) => {
      const hue = Math.round((i * 137.508 + 12) % 360);
      return [id, { stripe: `hsl(${hue} 68% 48%)`, text: `hsl(${hue} 72% 33%)`, textDark: `hsl(${hue} 78% 70%)` }];
    })
  );
}

/** Each class type's color, on its dot, its chip text and its selected pill. */
const TYPE_STYLE: Record<FitnessClassType, { dot: string; text: string; pill: string }> = {
  pilates: { dot: "bg-pink-600", text: "text-pink-700 dark:text-pink-300", pill: "border-pink-600 bg-pink-600/10" },
  yoga: { dot: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-300", pill: "border-emerald-600 bg-emerald-600/10" },
  spin: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", pill: "border-amber-500 bg-amber-500/10" },
  lifting: { dot: "bg-blue-600", text: "text-blue-700 dark:text-blue-300", pill: "border-blue-600 bg-blue-600/10" },
  climbing: { dot: "bg-orange-800", text: "text-orange-800 dark:text-orange-300", pill: "border-orange-800 bg-orange-800/10" },
};
const PARTS: PartOfDay[] = ["Morning", "Afternoon", "Evening"];

// The page used to remember each device's last picks and tick them on the next visit. Visitors choose first, every
// time, so those old saved picks are cleared away.
const forgetOldPicks = () => {
  try {
    localStorage.removeItem("fitnessnav-types");
    localStorage.removeItem("fitnessnav-online");
  } catch {}
};
const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

/**
 * FitnessNav: tick the kinds of class you want, tap Search, then pick any day of the week and see every matching class
 * at nearby studios on one page, grouped Morning / Afternoon / Evening, each with a Book link to the studio's own
 * schedule. Classes come from /fitness/classes (read from studios' own sites by the morning job, tools/class-ingest).
 */
export function ClassFinderRuntime({ config }: { config: ClassFinderBlockConfig }) {
  const offered = useMemo(() => {
    const keys = config.class_types?.length ? config.class_types : CLASS_TYPES.map((t) => t.key);
    return CLASS_TYPES.filter((t) => keys.includes(t.key));
  }, [config.class_types]);

  const [week, setWeek] = useState<Week | null>(null);
  const [failed, setFailed] = useState(false);
  // Nothing is ticked until the visitor picks.
  const [chosen, setChosen] = useState<Set<FitnessClassType>>(() => new Set());
  const [applied, setApplied] = useState<Set<FitnessClassType>>(() => new Set());
  const [online, setOnline] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  // Set by tapping a studio's name: the page then shows only that studio, until the chip above the days is cleared.
  const [studioId, setStudioId] = useState<string | null>(null);
  const results = useRef<HTMLElement>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number; mine: boolean } | null>(
    config.area_latitude != null && config.area_longitude != null ? { lat: config.area_latitude, lng: config.area_longitude, mine: false } : null
  );
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(() => seattleStamp());

  // The week's classes. Nothing is ticked until the visitor picks.
  useEffect(() => {
    forgetOldPicks();
    fetch("/fitness/classes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((w: Week) => setWeek(w))
      .catch(() => setFailed(true));
    const tick = () => setNow(seattleStamp());
    const t = setInterval(tick, 30_000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const studios = useMemo(() => new Map((week?.studios ?? []).map((s) => [s.id, s])), [week]);
  const studioColors = useMemo(() => studioPalette((week?.studios ?? []).map((s) => s.id)), [week]);
  // What matches the pick, split by the clock: classes that have started drop off the list as the day goes on.
  const matching = useMemo(
    () => (week?.classes ?? []).filter((c) => c.type !== "other" && applied.has(c.type) && (online || !c.online) && (!studioId || c.studioId === studioId)),
    [week, applied, online, studioId]
  );
  const visible = useMemo(() => matching.filter((c) => !hasStarted(c, now)), [matching, now]);
  const startedToday = matching.filter((c) => c.date === now.slice(0, 10) && hasStarted(c, now)).length;
  // Always opens on today, however late it is: the page tracks the clock, and when today's classes are over it says so
  // (and offers the next day) instead of quietly jumping to tomorrow's morning.
  const today = now.slice(0, 10);
  const days = useMemo(() => (week?.days ?? []).filter((d) => d >= today), [week, today]);
  const shownDay = day ?? (days.includes(today) ? today : (days[0] ?? null));
  const nextDay = days.find((d) => d > (shownDay ?? "") && visible.some((c) => c.date === d)) ?? null;
  const picked = applied.size > 0;
  const dayClasses = visible.filter((c) => c.date === shownDay);
  const dayStudios = new Set(dayClasses.map((c) => c.studioId)).size;

  function showStudio(id: string | null) {
    setStudioId(id);
    setDay(null);
    // The chip is above the days; bring it into view so the change is obvious.
    requestAnimationFrame(() => results.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (chosen.size === 0) return;
    const next = new Set(chosen);
    setApplied(next);
    if (week && shownDay && !visible.some((c) => c.date === shownDay)) setDay(null);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, mine: true });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  }

  const miles = (studioId: string) => {
    const s = studios.get(studioId);
    if (!origin || s?.latitude == null || s.longitude == null) return null;
    return milesBetween(origin.lat, origin.lng, s.latitude, s.longitude);
  };

  const studiosForHint = new Set((week?.classes ?? []).filter((c) => c.type !== "other" && chosen.has(c.type) && !c.online).map((c) => c.studioId)).size;

  return (
    <div className="flex flex-col gap-4 px-4 pb-10 pt-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold uppercase tracking-tight">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#df4f26] text-white">
              <Dumbbell className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </span>
            {config.title || "FitnessNav"}
          </h1>
          {config.subtitle && <p className="mt-1 text-sm text-muted-foreground">{config.subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : origin?.mine ? <LocateFixed className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
          {origin?.mine ? "Near you" : config.area_label ? `Near ${config.area_label}` : "Use my location"}
        </button>
      </header>

      <form onSubmit={search} className="flex flex-col gap-3 rounded-2xl border bg-background p-4">
        <h2 className="text-lg font-bold">What do you want to do?</h2>
        <div className="flex flex-wrap gap-2">
          {offered.map((t) => {
            const on = chosen.has(t.key);
            return (
              <label
                key={t.key}
                className={`inline-flex cursor-pointer select-none items-center gap-2 rounded-full border-[1.5px] px-3.5 py-2 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#df4f26] ${on ? TYPE_STYLE[t.key].pill : "border-border"}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={(e) => {
                    const next = new Set(chosen);
                    if (e.target.checked) next.add(t.key);
                    else next.delete(t.key);
                    setChosen(next);
                  }}
                />
                <span className={`h-2.5 w-2.5 rounded-full ${TYPE_STYLE[t.key].dot}`} />
                {t.label}
              </label>
            );
          })}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="h-[18px] w-[18px] accent-[#df4f26]" checked={online} onChange={(e) => setOnline(e.target.checked)} />
          Include online classes
        </label>
        <button type="submit" disabled={chosen.size === 0} className="rounded-xl bg-[#df4f26] px-4 py-3.5 text-base font-bold text-white disabled:opacity-50">
          Search classes
        </button>
        <p className="text-xs text-muted-foreground">
          {chosen.size === 0
            ? "Pick the kinds of class you want."
            : week
              ? `${[...chosen].map((k) => CLASS_TYPE_LABEL[k]).join(", ")} at ${studiosForHint} studio${studiosForHint === 1 ? "" : "s"} near you.`
              : " "}
        </p>
      </form>

      <section ref={results} aria-live="polite" className="flex scroll-mt-3 flex-col gap-3 rounded-2xl border bg-background p-4">
        {!week && !failed && (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading this week&apos;s classes…
          </p>
        )}
        {failed && <p className="py-8 text-center text-sm text-muted-foreground">Couldn&apos;t load the class schedule. Pull to refresh or try again in a minute.</p>}
        {week && !picked && <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Pick what you want to do above, then tap Search classes.</p>}
        {week && picked && shownDay && (
          <>
            {studioId && (
              <div>
                <button
                  type="button"
                  onClick={() => showStudio(null)}
                  aria-label={`Showing only ${studios.get(studioId)?.name ?? "this studio"}. Show every studio`}
                  style={{ "--studio": studioColors.get(studioId)?.stripe, "--studio-text": studioColors.get(studioId)?.text } as React.CSSProperties}
                  className="inline-flex max-w-full items-center gap-2 rounded-full border-[1.5px] border-[color:var(--studio)] bg-[color-mix(in_oklab,var(--studio)_12%,transparent)] py-1.5 pl-3 pr-2.5 text-sm font-bold text-[color:var(--studio-text)]"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--studio)]" />
                  <span className="min-w-0 truncate">{studios.get(studioId)?.name ?? "Studio"}</span>
                  <X className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                </button>
              </div>
            )}
            <div role="group" aria-label="Pick a day" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {days.map((d) => {
                const n = visible.filter((c) => c.date === d).length;
                const on = d === shownDay;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDay(d)}
                    className={`flex min-w-16 shrink-0 flex-col items-center rounded-xl border-[1.5px] px-1.5 py-2 ${on ? "border-foreground bg-foreground text-background" : "border-border"}`}
                  >
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${on ? "opacity-80" : "text-muted-foreground"}`}>
                      {d === today ? "Today" : dayLabel(d, { weekday: "short" })}
                    </span>
                    <span className="text-[22px] font-extrabold tabular-nums leading-tight">{dayLabel(d, { day: "numeric" })}</span>
                    <span className={`text-[11px] tabular-nums ${on ? "opacity-80" : "text-muted-foreground"}`}>{n ? `${n} class${n === 1 ? "" : "es"}` : "—"}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">
                {shownDay === today ? `Today, ${dayLabel(shownDay, { month: "short", day: "numeric" })}` : dayLabel(shownDay, { weekday: "long", month: "short", day: "numeric" })}
              </h2>
              {dayClasses.length > 0 && (
                <p className="text-xs tabular-nums text-muted-foreground">
                  {dayClasses.length} class{dayClasses.length === 1 ? "" : "es"} · {dayStudios} studio{dayStudios === 1 ? "" : "s"}
                </p>
              )}
            </div>
            {shownDay === today && startedToday > 0 && dayClasses.length > 0 && (
              <p className="-mt-1 text-xs text-muted-foreground">
                {startedToday} earlier class{startedToday === 1 ? " has" : "es have"} already started. Showing what&apos;s still to come.
              </p>
            )}
            {dayClasses.length === 0 ? (
              <p className="rounded-xl border px-4 py-6 text-center text-sm text-muted-foreground">
                {shownDay === today && startedToday > 0
                  ? "That's all the classes for today."
                  : `No ${[...applied].map((k) => CLASS_TYPE_LABEL[k].toLowerCase()).join(" or ")} classes listed${studioId ? ` at ${studios.get(studioId)?.name ?? "this studio"}` : ""} for ${shownDay === today ? "today" : dayLabel(shownDay, { weekday: "long" })}.${nextDay ? "" : ` Try another day${studioId ? ", show every studio," : ""} or add a class type.`}`}
                {nextDay && (
                  <button
                    type="button"
                    onClick={() => setDay(nextDay)}
                    className="mx-auto mt-3 flex items-center rounded-full border-[1.5px] border-[#df4f26] px-4 py-2 text-sm font-bold text-[#df4f26]"
                  >
                    See {dayLabel(nextDay, { weekday: "long" })}&apos;s classes · {visible.filter((c) => c.date === nextDay).length}
                  </button>
                )}
              </p>
            ) : (
              PARTS.map((part) => {
                const rows = dayClasses.filter((c) => partOfDay(c.start) === part);
                if (!rows.length) return null;
                return (
                  <div key={part} className="flex flex-col gap-2">
                    <h3 className="mt-1 flex gap-2 px-0.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {part}
                      <span>{rows.length}</span>
                    </h3>
                    <ul className="divide-y overflow-hidden rounded-xl border">
                      {rows.map((c) => {
                        const s = studios.get(c.studioId);
                                                const len = classMinutes(c.start, c.end);
                        const mi = miles(c.studioId);
                        const book = s?.bookUrl ?? s?.website ?? null;
                        const type = c.type as FitnessClassType;
                        const color = studioColors.get(c.studioId);
                        return (
                          // Each studio has its own color, down the row's left edge and on its name, so a week of classes from
                          // different studios never blends together.
                          <li
                            key={c.id}
                            style={color ? ({ "--studio": color.stripe, "--studio-text": color.text, "--studio-text-dark": color.textDark } as React.CSSProperties) : undefined}
                            className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-3 px-3.5 py-3 shadow-[inset_4px_0_0_var(--studio,transparent)]"
                          >
                            <div className="font-bold tabular-nums leading-tight">
                              {time12(c.start)}
                              {len && <span className="block text-xs font-medium text-muted-foreground">{len} min</span>}
                            </div>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${TYPE_STYLE[type].text}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${TYPE_STYLE[type].dot}`} />
                                {CLASS_TYPE_LABEL[type]}
                              </span>
                              <span className="break-words font-semibold">{c.name}</span>
                              <span className="break-words text-xs text-muted-foreground">
                                {c.online ? "Online · " : ""}
                                {s && !studioId ? (
                                  <button
                                    type="button"
                                    onClick={() => showStudio(c.studioId)}
                                    aria-label={`Show only ${s.name}`}
                                    className="-my-1 py-1 text-left font-bold text-[color:var(--studio-text,inherit)] underline decoration-dotted decoration-1 underline-offset-[3px] dark:text-[color:var(--studio-text-dark,inherit)]"
                                  >
                                    {s.name}
                                  </button>
                                ) : (
                                  <span className="font-bold text-[color:var(--studio-text,inherit)] dark:text-[color:var(--studio-text-dark,inherit)]">{s?.name ?? "Studio"}</span>
                                )}
                                {mi != null ? ` · ${mi.toFixed(1)} mi` : ""}
                                {c.instructor ? ` · ${c.instructor}` : ""}
                              </span>
                              {c.spots && <span className="text-xs font-semibold text-[#df4f26]">{c.spots}</span>}
                            </div>
                            {book ? (
                              <a
                                href={book}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="self-center whitespace-nowrap rounded-full border-[1.5px] border-[#df4f26] px-3 py-1.5 text-xs font-bold text-[#df4f26]"
                              >
                                Book
                              </a>
                            ) : (
                              <span />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </>
        )}
      </section>

      {week?.readAt && (
        <p className="text-xs text-muted-foreground">
          Classes read from each studio&apos;s own schedule on{" "}
          {new Date(week.readAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. Times can change, so book on the studio&apos;s site.
        </p>
      )}
    </div>
  );
}
