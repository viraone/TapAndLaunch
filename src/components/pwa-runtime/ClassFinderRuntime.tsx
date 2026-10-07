"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Dumbbell, Loader2, LocateFixed, MapPin, X } from "lucide-react";
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
 * One color per studio, told apart by hue. Only the studios that can appear in the list (the visitor's class types,
 * within their distance) get a color, and the hues are spread evenly around the wheel between them: a dozen studios
 * are 30° apart, where a hue for each of the city's 115 studios left neighbours looking alike. Past twelve, the next
 * dozen share the wheel again at a darker shade, then a lighter one. Assigned by the studio's place in a sorted list,
 * so a studio keeps its color while the picks stay the same.
 */
function studioPalette(ids: Iterable<string>): Map<string, { stripe: string; text: string; textDark: string }> {
  const sorted = [...new Set(ids)].sort();
  const RING = 12;
  const SHADES = [
    [68, 48],
    [62, 36],
    [78, 60],
  ];
  return new Map(
    sorted.map((id, i) => {
      const ring = Math.floor(i / RING);
      const inRing = Math.min(RING, sorted.length - ring * RING);
      const hue = Math.round(((i % RING) * 360) / inRing + 12 + ring * 15) % 360;
      const [sat, light] = SHADES[ring % SHADES.length];
      return [id, { stripe: `hsl(${hue} ${sat}% ${light}%)`, text: `hsl(${hue} 72% 33%)`, textDark: `hsl(${hue} 78% 70%)` }];
    })
  );
}

/** How far from the visitor a studio may be, in miles; null is any distance. */
type Within = 1 | 2 | 5 | null;
const WITHIN_OPTIONS: Within[] = [1, 2, 5, null];
/** The page starts at 2 miles once the visitor's own location is known (a walk or a short ride); otherwise any distance. */
const DEFAULT_WITHIN: Within = 2;

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
const FIX_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 120_000 };
/** Smooth scrolling, unless the visitor has asked their device for less motion. */
const scrollBehavior = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
/** "0.0 mi" for a studio right at the visitor's spot read like a mistake; under a tenth of a mile is said in words. */
const milesLabel = (mi: number) => (mi < 0.05 ? "under 0.1 mi" : `${mi.toFixed(1)} mi`);
const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

/**
 * FitnessNav: tick the kinds of class you want, tap Search, then pick any day of the week and see every matching class
 * at nearby studios on one page, grouped Morning / Afternoon / Evening, each with a Book link to the studio's own
 * schedule. Classes come from /fitness/classes (read from studios' own sites by the nightly job, tools/class-ingest).
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
  // After the first Search, a tap on a pill updates the list straight away; nobody should have to tap Search twice.
  const [searched, setSearched] = useState(false);
  // Set by Search (not by a live pill change): the day heading then takes focus once the results have rendered.
  const focusResults = useRef(false);
  const [online, setOnline] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  // Set by tapping a studio's name: the page then shows only that studio, until the chip above the days is cleared.
  const [studioId, setStudioId] = useState<string | null>(null);
  const results = useRef<HTMLElement>(null);
  // Morning / Afternoon / Evening groups the visitor has folded away (all open to begin with).
  const [folded, setFolded] = useState<Set<PartOfDay>>(() => new Set());
  const [origin, setOrigin] = useState<{ lat: number; lng: number; mine: boolean } | null>(
    config.area_latitude != null && config.area_longitude != null ? { lat: config.area_latitude, lng: config.area_longitude, mine: false } : null
  );
  const [locating, setLocating] = useState(false);
  const fixAt = useRef(0);
  // One line under the header after a tap on the location pill that could not help (location off, or a failed fix).
  const [tip, setTip] = useState<string | null>(null);
  // "soonest": by start time, nearest studio first when times match. "nearest": closest studio first, within each part of the day.
  const [sort, setSort] = useState<"soonest" | "nearest">("soonest");
  // "auto" until the visitor picks a distance: 2 miles once their own location is known, any distance before that
  // (distances from the middle of the area say little about how far a studio is from them).
  const [within, setWithin] = useState<Within | "auto">("auto");
  const [now, setNow] = useState(() => seattleStamp());

  // Finds where the visitor is, so every distance on the page is from them and the closest studios can come first.
  // The position stays in this browser: it is never sent to us or saved.
  const gotFix = useCallback((p: GeolocationPosition) => {
    fixAt.current = Date.now();
    setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude, mine: true });
    setLocating(false);
    setTip(null);
  }, []);
  const noFix = useCallback(() => setLocating(false), []);
  const area = config.area_label?.trim() || "the middle of the area";
  // The pill: asks again and shows "Finding you…" while it waits. It always asks (a prompt that was swiped away looks
  // like a "no" to the page, and a browser that really remembers a block answers at once); when the browser cannot
  // help, one line under the header says what to do, worded for what the page is actually showing.
  function locate() {
    if (!("geolocation" in navigator)) return setTip(`This browser can't share your location, so distances are from ${area}.`);
    const hadFix = !!origin?.mine;
    setLocating(true);
    setTip(null);
    navigator.geolocation.getCurrentPosition(gotFix, (e) => {
      noFix();
      if (hadFix) setTip("Couldn't update your location just now. Distances are still from where you were last found.");
      else if (e.code === e.PERMISSION_DENIED) setTip("Location is off for this site. Turn it on in your browser settings to see what's closest to you.");
      else setTip(`Couldn't find you just now, so distances are from ${area}. Tap the location button to try again.`);
    }, FIX_OPTIONS);
  }

  // The week's classes. A request that hangs (a flaky connection) becomes the error state after 15 seconds instead of a
  // spinner that never ends; "Try again" and coming back online call this again.
  const [retrying, setRetrying] = useState(false);
  const load = useCallback(() => {
    // The browser never keeps a copy (the feed says max-age=0); the CDN's five-minute copy answers most visits.
    fetch("/fitness/classes", { signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(15_000) : undefined })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((w: Week) => {
        setWeek(w);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setRetrying(false));
  }, []);
  // Keeps the "Try again" button on screen (and focus on it) while the request runs, instead of swapping in the spinner.
  const retry = useCallback(() => {
    setRetrying(true);
    load();
  }, [load]);

  // Nothing is ticked until the visitor picks.
  useEffect(() => {
    forgetOldPicks();
    // Asked as soon as the page opens, so the first list already has distances from the visitor.
    if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition(gotFix, noFix, FIX_OPTIONS);
    load();
    // Back in coverage: fetch again on its own.
    window.addEventListener("online", retry);
    const tick = () => setNow(seattleStamp());
    const t = setInterval(tick, 30_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      tick();
      // Someone who has moved since the last fix (a few minutes ago) gets their distances worked out again.
      if (fixAt.current && Date.now() - fixAt.current > 5 * 60_000 && "geolocation" in navigator) navigator.geolocation.getCurrentPosition(gotFix, noFix, FIX_OPTIONS);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", retry);
    };
  }, [gotFix, noFix, load, retry]);

  // A kind of class nobody has listed yet (rock climbing, for now) is not offered: a button that only ever says "none" looks broken.
  const available = useMemo(() => (week ? offered.filter((t) => week.classes.some((c) => c.type === t.key)) : []), [offered, week]);
  const studios = useMemo(() => new Map((week?.studios ?? []).map((s) => [s.id, s])), [week]);
  const miles = (studioId: string) => {
    const s = studios.get(studioId);
    if (!origin || s?.latitude == null || s.longitude == null) return null;
    return milesBetween(origin.lat, origin.lng, s.latitude, s.longitude);
  };

  const withinMi: Within = within === "auto" ? (origin?.mine ? DEFAULT_WITHIN : null) : within;
  // A studio whose place is unknown only shows at any distance.
  const inRange = (id: string) => withinMi == null || (miles(id) ?? Infinity) <= withinMi;
  // What matches the pick: the class types, online or not, and within the chosen distance...
  const matchingAnywhere = useMemo(
    () => (week?.classes ?? []).filter((c) => c.type !== "other" && applied.has(c.type) && (online || !c.online)),
    [week, applied, online]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- inRange depends on origin and withinMi, both listed
  const matchingAll = useMemo(() => matchingAnywhere.filter((c) => inRange(c.studioId)), [matchingAnywhere, origin, withinMi, studios]);
  // ...and, after a tap on a studio's name, that studio alone. Split by the clock: classes that have started drop off
  // the list as the day goes on.
  const matching = useMemo(() => (studioId ? matchingAll.filter((c) => c.studioId === studioId) : matchingAll), [matchingAll, studioId]);
  const visible = useMemo(() => matching.filter((c) => !hasStarted(c, now)), [matching, now]);
  // Colors for the studios that can appear in the list (not for the one tapped, so its chip keeps the color it had).
  const studioColors = useMemo(() => studioPalette(matchingAll.map((c) => c.studioId)), [matchingAll]);
  const startedToday = matching.filter((c) => c.date === now.slice(0, 10) && hasStarted(c, now)).length;
  // Always opens on today, however late it is: the page tracks the clock, and when today's classes are over it says so
  // (and offers the next day) instead of quietly jumping to tomorrow's morning.
  const today = now.slice(0, 10);
  const days = useMemo(() => (week?.days ?? []).filter((d) => d >= today), [week, today]);
  const shownDay = day ?? (days.includes(today) ? today : (days[0] ?? null));
  // For the "nothing to show" message: what they picked, and the studio if one is chosen.
  const pickedLabel = [...applied].map((k) => CLASS_TYPE_LABEL[k]).join(" or ");
  const atStudio = studioId ? ` at ${studios.get(studioId)?.name ?? "this studio"}` : "";
  const nextDay = days.find((d) => d > (shownDay ?? "") && visible.some((c) => c.date === d)) ?? null;
  const picked = applied.size > 0;
  const withinLabel = withinMi != null ? ` within ${withinMi} mi` : "";
  // When the distance alone is hiding the day's classes, the "nothing to show" message offers the next distance up that
  // has some (2 mi before 5 mi before any), with the count, so one tap shows the closest classes rather than the whole city.
  const farther = useMemo(() => {
    if (withinMi == null || !shownDay) return null;
    const left = matchingAnywhere.filter((c) => c.date === shownDay && !hasStarted(c, now) && (!studioId || c.studioId === studioId));
    for (const o of WITHIN_OPTIONS) {
      if (o != null && o <= withinMi) continue;
      const n = left.filter((c) => o == null || (miles(c.studioId) ?? Infinity) <= o).length;
      if (n) return { within: o, n };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- miles depends on origin and studios, both listed
  }, [withinMi, shownDay, matchingAnywhere, now, studioId, origin, studios]);
  const dayTitle = !shownDay ? "" : shownDay === today ? `Today, ${dayLabel(shownDay, { month: "short", day: "numeric" })}` : dayLabel(shownDay, { weekday: "long", month: "short", day: "numeric" });
  const dayClasses = visible
    .filter((c) => c.date === shownDay)
    .sort((a, b) => {
      // Studios without a known place go last when sorting by distance.
      const da = miles(a.studioId) ?? Infinity;
      const db = miles(b.studioId) ?? Infinity;
      const byTime = a.start.localeCompare(b.start);
      return sort === "nearest" ? da - db || byTime : byTime || da - db;
    });
  const dayStudios = new Set(dayClasses.map((c) => c.studioId)).size;

  // Moving to another day keeps the parts of the day as the visitor had them: what was open stays open, what was
  // folded stays folded. A part that was not on screen for the day they left (the morning, once today's mornings have
  // passed) comes in folded with its one-class preview, so tomorrow opens on the afternoon they were looking at
  // rather than pushing it down under a full morning. `pool` is the classes the new day will show, when it is not `visible`.
  function goToDay(d: string, pool: FitnessClass[] = visible) {
    const before = new Set(dayClasses.map((c) => partOfDay(c.start)));
    const after = new Set(pool.filter((c) => c.date === d).map((c) => partOfDay(c.start)));
    const newParts = PARTS.filter((p) => after.has(p) && !before.has(p));
    if (newParts.length && before.size) setFolded((prev) => new Set([...prev, ...newParts]));
    setDay(d);
  }

  function showStudio(id: string | null) {
    setStudioId(id);
    if (id && shownDay) {
      // Stay on the day in view when this studio still has a class there; otherwise its first day with one.
      const mine = visible.filter((c) => c.studioId === id);
      if (!mine.some((c) => c.date === shownDay)) {
        const first = days.find((d) => mine.some((c) => c.date === d));
        if (first) goToDay(first, mine);
      }
    }
    focusStudio.current = true;
    // The chip is above the days; bring it into view so the change is obvious.
    requestAnimationFrame(() => results.current?.scrollIntoView({ block: "start", behavior: scrollBehavior() }));
  }

  // Shows the classes for a set of picks. Keeps the day in view when the new picks have something there (judged by the
  // new picks, not the old ones); otherwise back to today.
  function apply(next: Set<FitnessClassType>) {
    setApplied(next);
    const stillThere =
      !!week &&
      !!shownDay &&
      week.classes.some(
        (c) => c.date === shownDay && c.type !== "other" && next.has(c.type) && (online || !c.online) && inRange(c.studioId) && (!studioId || c.studioId === studioId) && !hasStarted(c, now)
      );
    if (week && shownDay && !stillThere) setDay(null);
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (chosen.size === 0) return;
    apply(new Set(chosen));
    setSearched(true);
    focusResults.current = true;
    // On a phone the results start below the fold: without this a tap on Search looks like it did nothing.
    requestAnimationFrame(() => results.current?.scrollIntoView({ block: "start", behavior: scrollBehavior() }));
  }

  // The day strip keeps the chosen day in view (it holds a week of chips but shows four or five at a time).
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    const chip = el?.querySelector<HTMLElement>(`[data-day="${shownDay}"]`);
    if (!el || !chip) return;
    el.scrollTo({ left: chip.offsetLeft - el.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2, behavior: scrollBehavior() });
  }, [shownDay]);

  // After a Search, focus lands on the chosen day's chip: screen readers hear "Today, October 6, 52 classes" and the
  // Tab key carries on through the days. The heading itself is not a stop, so the chips stay in the Tab path.
  const focusDayChip = () => strip.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  useEffect(() => {
    if (!focusResults.current) return;
    focusResults.current = false;
    focusDayChip();
  }, [applied]);
  // A studio tap replaces the tapped name with plain text, which would drop focus to the top of the page: focus moves to
  // the studio chip instead, and back to the day chip when the chip is cleared.
  const studioChip = useRef<HTMLButtonElement>(null);
  const focusStudio = useRef(false);
  useEffect(() => {
    if (!focusStudio.current) return;
    focusStudio.current = false;
    if (studioId) studioChip.current?.focus({ preventScroll: true });
    else focusDayChip();
  }, [studioId]);

  const studiosForHint = new Set((week?.classes ?? []).filter((c) => c.type !== "other" && chosen.has(c.type) && !c.online && inRange(c.studioId)).map((c) => c.studioId)).size;

  return (
    <div className="flex flex-col gap-4 px-4 pb-10 pt-4">
      <header className="flex flex-col gap-2">
        {/* The name never shrinks or wraps; on a phone the location pill drops under it instead of covering its last letters. */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h1 className="flex shrink-0 items-center gap-2 whitespace-nowrap text-2xl font-extrabold uppercase tracking-tight">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#df4f26] text-white">
              <Dumbbell className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </span>
            {config.title || "FitnessNav"}
          </h1>
          <button
            type="button"
            onClick={locate}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : origin?.mine ? <LocateFixed className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {locating && !origin?.mine ? "Finding you…" : origin?.mine ? "Near you" : config.area_label ? `Near ${config.area_label}` : "Use my location"}
          </button>
        </div>
        {config.subtitle && <p className="text-sm text-muted-foreground">{config.subtitle}</p>}
        <p role="status" className={tip ? "text-xs text-muted-foreground" : "sr-only"}>
          {tip}
        </p>
      </header>

      <form onSubmit={search} className="flex flex-col gap-3 rounded-2xl border bg-background p-4">
        <h2 className="text-lg font-bold">What do you want to do?</h2>
        <div className="flex flex-wrap gap-2">
          {!week && !failed && offered.slice(0, 4).map((t) => <span key={t.key} aria-hidden className="h-[42px] w-28 animate-pulse rounded-full bg-muted" />)}
          {available.map((t) => {
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
                    if (searched) apply(next);
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
        {/* Disabled: a paler orange with the label still white. Fading the whole button left grey-on-brown on a dark page. */}
        <button
          type="submit"
          disabled={chosen.size === 0}
          className="rounded-xl bg-[#c23f1a] px-4 py-3.5 text-base font-bold text-white disabled:bg-[#c23f1a]/45 disabled:text-white/85"
        >
          Search classes
        </button>
        <p className="text-xs text-muted-foreground">
          {chosen.size === 0
            ? "Pick the kinds of class you want."
            : week
              ? `${[...chosen].map((k) => CLASS_TYPE_LABEL[k]).join(", ")} at ${studiosForHint} studio${studiosForHint === 1 ? "" : "s"} ${withinMi != null ? `within ${withinMi} mi` : "near you"}.`
              : " "}
        </p>
      </form>

      <section ref={results} className="flex scroll-mt-3 flex-col gap-3 rounded-2xl border bg-background p-4">
        {/* One status region from the first paint, so a failed load or the "pick above" note is read out when it appears. */}
        <div role="status" aria-busy={!week && !failed} className={!week || !picked ? "flex flex-col" : "sr-only"}>
          {!week && !failed && (
            <>
              {/* The shape of what is coming (a row of days, a heading, three classes), so a slow connection shows a page
                  filling in rather than an empty card with one line in it. */}
              <div aria-hidden className="flex animate-pulse flex-col gap-3">
                <div className="-mx-4 flex gap-2 overflow-hidden px-4">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-[74px] w-[72px] shrink-0 rounded-xl bg-foreground/[0.07]" />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-6 w-36 rounded-md bg-foreground/[0.07]" />
                  <div className="h-8 w-32 rounded-full bg-foreground/[0.07]" />
                </div>
                <div className="h-3 w-44 rounded bg-foreground/[0.07]" />
                <div className="mt-1 h-3 w-24 rounded bg-foreground/[0.07]" />
                <div className="flex flex-col gap-px overflow-hidden rounded-xl border">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 px-3.5 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="h-4 w-14 rounded bg-foreground/[0.07]" />
                        <div className="h-3 w-10 rounded bg-foreground/[0.07]" />
                        <div className="h-6 w-14 rounded-full bg-foreground/[0.07]" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="h-4 w-4/5 rounded bg-foreground/[0.07]" />
                        <div className="h-3 w-3/5 rounded bg-foreground/[0.07]" />
                        <div className="h-3 w-2/5 rounded bg-foreground/[0.07]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading this week&apos;s classes…
              </p>
            </>
          )}
          {failed && !week && (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
              <p>Couldn&apos;t load the class schedule.</p>
              <button
                type="button"
                onClick={retry}
                disabled={retrying}
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#c23f1a] bg-background px-4 py-2 text-sm font-bold text-[#c23f1a] disabled:opacity-60 dark:border-[#ff7a52] dark:text-[#ff7a52]"
              >
                {retrying && <Loader2 className="h-4 w-4 animate-spin" />}
                {retrying ? "Trying again…" : "Try again"}
              </button>
            </div>
          )}
          {week && !picked && <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{searched ? "Pick what you want to do above." : "Pick what you want to do above, then tap Search classes."}</p>}
        </div>
        {week && picked && shownDay && (
          <>
            {studioId && (
              <div>
                <button
                  ref={studioChip}
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
            {/* How far to look. With over a hundred studios across the city, one class type on a weekday is hundreds of
                rows; this keeps the week to studios the visitor can get to. Hidden when no distance can be worked out. */}
            {origin && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                {/* Where the distances are from (the visitor, or the middle of the area) is what the location pill in the header says. */}
                <span aria-hidden className="font-semibold text-muted-foreground">
                  Within
                </span>
                <div role="group" aria-label={`How far from ${origin.mine ? "you" : area}`} className="flex rounded-full bg-muted p-0.5 font-semibold">
                  {WITHIN_OPTIONS.map((o) => (
                    <button
                      key={String(o)}
                      type="button"
                      aria-pressed={withinMi === o}
                      onClick={() => setWithin(o)}
                      className={`min-h-9 rounded-full px-3 tabular-nums ${withinMi === o ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                    >
                      {o == null ? "Any distance" : `${o} mi`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div ref={strip} role="group" aria-label="Pick a day" className="-mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none]">
              {days.map((d) => {
                const n = visible.filter((c) => c.date === d).length;
                const on = d === shownDay;
                return (
                  <button
                    key={d}
                    type="button"
                    data-day={d}
                    aria-pressed={on}
                    aria-label={`${d === today ? "Today" : dayLabel(d, { weekday: "long" })}, ${dayLabel(d, { month: "long", day: "numeric" })}, ${n ? `${n} class${n === 1 ? "" : "es"}` : "no classes"}`}
                    onClick={() => goToDay(d)}
                    className={`flex min-w-16 shrink-0 snap-start flex-col items-center rounded-xl border-[1.5px] px-1.5 py-2 ${on ? "border-foreground bg-foreground text-background" : "border-border"}`}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">{dayTitle}</h2>
              {dayClasses.length > 1 && dayClasses.some((c) => miles(c.studioId) != null) && (
                <div role="group" aria-label="Order the classes" className="flex shrink-0 rounded-full bg-muted p-0.5 text-xs font-semibold">
                  {(["soonest", "nearest"] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={sort === o}
                      onClick={() => setSort(o)}
                      className={`min-h-9 rounded-full px-3 capitalize ${sort === o ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p role="status" className={dayClasses.length ? "-mt-1 text-xs tabular-nums text-muted-foreground" : "sr-only"}>
              {dayClasses.length
                ? `${dayClasses.length} class${dayClasses.length === 1 ? "" : "es"} · ${dayStudios} studio${dayStudios === 1 ? "" : "s"}${shownDay === today && startedToday > 0 ? ` · ${startedToday} already started` : ""}`
                : `No ${pickedLabel} classes${atStudio}${withinLabel} for ${dayTitle}.`}
            </p>
            {dayClasses.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-[#df4f26]/30 bg-[#df4f26]/5 px-4 py-8 text-center">
                <p className="text-xl font-extrabold leading-snug text-foreground">
                  {shownDay === today
                    ? `There are no ${pickedLabel} classes${atStudio}${withinLabel} at this time.`
                    : `No ${pickedLabel} classes listed${atStudio}${withinLabel} for ${dayLabel(shownDay, { weekday: "long" })}.${nextDay || studioId || farther ? "" : " Try another day or add a class type."}`}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {farther && (
                    <button
                      type="button"
                      onClick={() => setWithin(farther.within)}
                      className="flex items-center rounded-full border-[1.5px] border-[#c23f1a] bg-background px-4 py-2 text-sm font-bold text-[#c23f1a] dark:border-[#ff7a52] dark:text-[#ff7a52]"
                    >
                      {farther.within == null ? "Look any distance" : `Look within ${farther.within} mi`} · {farther.n}
                    </button>
                  )}
                  {nextDay && (
                    <button
                      type="button"
                      onClick={() => goToDay(nextDay)}
                      className="flex items-center rounded-full border-[1.5px] border-[#c23f1a] bg-background px-4 py-2 text-sm font-bold text-[#c23f1a] dark:border-[#ff7a52] dark:text-[#ff7a52]"
                    >
                      See {dayLabel(nextDay, { weekday: "long" })}&apos;s classes · {visible.filter((c) => c.date === nextDay).length}
                    </button>
                  )}
                  {studioId && (
                    <button type="button" onClick={() => showStudio(null)} className="flex items-center rounded-full border-[1.5px] border-foreground/40 bg-background px-4 py-2 text-sm font-bold">
                      Show every studio
                    </button>
                  )}
                </div>
              </div>
            ) : (
              PARTS.map((part) => {
                const rows = dayClasses.filter((c) => partOfDay(c.start) === part);
                if (!rows.length) return null;
                // A folded group keeps its first class in view (an empty card under a heading felt broken) and offers the rest
                // in one tap; a group with a single class has nothing to fold.
                const isFolded = folded.has(part) && rows.length > 1;
                const shown = isFolded ? rows.slice(0, 1) : rows;
                const toggle = () =>
                  setFolded((prev) => {
                    const next = new Set(prev);
                    if (next.has(part)) next.delete(part);
                    else next.add(part);
                    return next;
                  });
                return (
                  <div key={part} className="flex flex-col gap-2">
                    <h3 className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          aria-expanded={!isFolded}
                          aria-controls={`part-${part}`}
                          onClick={toggle}
                          className="flex min-h-11 w-full items-center gap-2 rounded-lg px-0.5 text-left uppercase tracking-widest"
                        >
                          {part}
                          <span>
                            {rows.length}
                            <span className="sr-only"> classes</span>
                          </span>
                          {/* A bare arrow said nothing; the control says what a tap does, and to which part of the day. "Show all" because
                              one class stays in view when folded; no count here, the heading and the "more classes" row carry it. */}
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-semibold normal-case tracking-normal text-foreground">
                            {isFolded ? `Show all ${part.toLowerCase()} classes` : `Hide ${part.toLowerCase()} classes`}
                            <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isFolded ? "" : "rotate-180"}`} strokeWidth={2.5} aria-hidden />
                          </span>
                        </button>
                      ) : (
                        <span className="flex min-h-11 items-center gap-2 px-0.5">
                          {part}
                          <span>
                            {rows.length}
                            <span className="sr-only"> class</span>
                          </span>
                        </span>
                      )}
                    </h3>
                    <ul id={`part-${part}`} className="divide-y overflow-hidden rounded-xl border">
                      {shown.map((c) => {
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
                            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 px-3.5 py-2.5 shadow-[inset_4px_0_0_var(--studio,transparent)]"
                          >
                            {/* Time, length and the Book button stack in the left column, so the name and the details have the whole width. */}
                            <div className="flex flex-col items-start gap-1.5 whitespace-nowrap">
                              <span className="text-[15px] font-bold tabular-nums leading-tight">
                                {time12(c.start)}
                                {len && <span className="block text-[11px] font-medium text-muted-foreground">{len} min</span>}
                              </span>
                              {book && (
                                <a
                                  href={book}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-full border-[1.5px] border-[#c23f1a] px-3 py-1 text-xs font-bold text-[#c23f1a] dark:border-[#ff7a52] dark:text-[#ff7a52]"
                                >
                                  Book
                                </a>
                              )}
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                              <span className="break-words font-semibold leading-snug">{c.name}</span>
                              <div>
                                <span className="break-words text-[13px] leading-snug text-muted-foreground">
                                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${TYPE_STYLE[type].text}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${TYPE_STYLE[type].dot}`} />
                                    {CLASS_TYPE_LABEL[type]}
                                  </span>
                                  {" · "}
                                  {c.online ? "Online · " : ""}
                                  {s && !studioId ? (
                                    <button
                                      type="button"
                                      onClick={() => showStudio(c.studioId)}
                                      aria-label={`Show only ${s.name}`}
                                      className="-my-1 py-1 text-left text-sm font-bold text-[color:var(--studio-text,inherit)] underline decoration-dotted decoration-1 underline-offset-[3px] dark:text-[color:var(--studio-text-dark,inherit)]"
                                    >
                                      {s.name}
                                    </button>
                                  ) : (
                                    <span className="text-sm font-bold text-[color:var(--studio-text,inherit)] dark:text-[color:var(--studio-text-dark,inherit)]">{s?.name ?? "Studio"}</span>
                                  )}
                                  {mi != null ? ` · ${milesLabel(mi)}` : ""}
                                  {c.instructor ? ` · ${c.instructor}` : ""}
                                  {c.spots && (
                                    <>
                                      {" · "}
                                      <span className="font-semibold text-[#c23f1a] dark:text-[#ff7a52]">{c.spots}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                      {isFolded && (
                        <li>
                          <button type="button" onClick={toggle} className="flex min-h-11 w-full items-center justify-center gap-1.5 bg-muted/60 px-3 text-xs font-semibold text-foreground">
                            {rows.length - 1} more {rows.length - 1 === 1 ? "class" : "classes"}
                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                          </button>
                        </li>
                      )}
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
