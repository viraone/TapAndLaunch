"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, ExternalLink, Globe, LocateFixed, Loader2, MapPin, Phone, Navigation, RefreshCw, Search, Star, UtensilsCrossed, X } from "lucide-react";
import type { CuisineKey, FoodDirectoryBlockConfig } from "@/types/database";
import type { NearbyPlace } from "@/lib/food/nearby";
import { CUISINES, CUISINE_BY_KEY } from "@/lib/food/cuisines";
import { computeOpenStatus, type OpenStatus } from "@/lib/food/hours";
import { computeHappyHour, daysLabel, windowTimeLabel, type CloseInfo, type HappyHourStatus } from "@/lib/food/happyHour";
import { driveMinutes, travelEstimate, walkLabel, walkMinutes, type TravelMode } from "@/lib/food/walk";
import { hoursRows, mapsPlaceUrl, menuSearchUrl, safeWebsite, telHref } from "@/lib/food/placeSheet";
import type { PopularDish } from "@/lib/food/dishes";
import type { PlaceReview } from "@/lib/food/reviews";
import { filterMenu, type MenuSection } from "@/lib/food/menuItems";

type Position = { latitude: number; longitude: number; label: string; live: boolean };
type Filter = "all" | CuisineKey;
type Sort = "open" | "distance" | "happy";

/** What a place's own hours say about closing, for happy hours that run "until close"; null when it isn't open now. */
function closeInfoOf(status: OpenStatus): CloseInfo {
  return status.state === "open" || status.state === "closing_soon" ? { closesInMinutes: status.closesInMinutes, closesAtLabel: status.closesAtLabel } : null;
}

/** "Ends in 12 min" under an hour, else "Until 6 PM". */
function happyEndsLabel(h: Extract<HappyHourStatus, { state: "active" }>): string {
  if (h.endsInMinutes !== null && h.endsInMinutes <= 60) return `ends in ${h.endsInMinutes} min`;
  return h.endsAtLabel ? `until ${h.endsAtLabel}` : "now";
}

/** Cuisine tiles shown before "More": All + this many, then the More tile (two rows of four). */
const COLLAPSED_TILES = 6;

/** Stable warm gradient per place for the avatar. */
const AVATAR_COLORS = [
  "from-orange-400 to-rose-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-red-400 to-orange-500",
  "from-yellow-400 to-amber-500",
  "from-fuchsia-400 to-rose-500",
];
function avatarColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** "350 ft" under a tenth of a mile (next-door places all read 0.0 mi otherwise), else "1.2 mi". */
function distanceLabel(miles: number): string {
  if (miles < 0.1) return `${Math.max(50, Math.round((miles * 5280) / 50) * 50)} ft`;
  return `${miles.toFixed(1)} mi`;
}

/**
 * LiveBites. Asks the browser for the viewer's position once, loads the
 * restaurants our server has for that spot (Google Places, cached — see
 * lib/food/nearby.ts), and computes open / closing soon / closed from each
 * place's hours *right now*, re-evaluating every 30 s so countdowns stay
 * honest without any network traffic.
 */
export function FoodDirectoryRuntime({ config }: { config: FoodDirectoryBlockConfig }) {
  const radius = config.radius_miles ?? 2;
  const cuisines = (config.cuisines ?? CUISINES.map((c) => c.key)).map((k) => CUISINE_BY_KEY[k]).filter(Boolean);
  const [position, setPosition] = useState<Position | null>(null);
  const [locState, setLocState] = useState<"asking" | "live" | "fallback" | "none">("asking");
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  /** The place whose details sheet is open (looked up live so its status keeps ticking). */
  const [openPlaceId, setOpenPlaceId] = useState<string | null>(null);
  const [showAllCuisines, setShowAllCuisines] = useState(false);
  /** Cuisines whose own Google search is confirmed for the current position. */
  const [fetchedCuisines, setFetchedCuisines] = useState<Set<CuisineKey>>(() => new Set());
  const [loadingCuisine, setLoadingCuisine] = useState<CuisineKey | null>(null);
  const [sort, setSort] = useState<Sort>(config.default_sort ?? "open");
  const [now, setNow] = useState(() => new Date());

  function applyFallback() {
    if (config.fallback_latitude !== undefined && config.fallback_longitude !== undefined) {
      setPosition({
        latitude: config.fallback_latitude,
        longitude: config.fallback_longitude,
        label: config.fallback_label ?? "default area",
        live: false,
      });
      setLocState("fallback");
    } else {
      setLocState("none");
    }
  }

  /** All setState calls here run inside geolocation callbacks or a deferred
   * tick, never synchronously, so the mount effect can call this. */
  function requestPosition() {
    if (!("geolocation" in navigator)) {
      window.setTimeout(applyFallback, 0);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, label: "your location", live: true });
        setLocState("live");
      },
      () => applyFallback(),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  function locate() {
    setLocState("asking");
    requestPosition();
  }

  useEffect(() => {
    requestPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate open/closed twice a minute so "Closes in N min" ticks.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function fetchNearby(pos: Position, cuisine?: CuisineKey): Promise<{ places: NearbyPlace[]; fetchedCuisines: CuisineKey[] }> {
    const res = await fetch("/food/nearby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: pos.latitude, longitude: pos.longitude, radiusMiles: radius, ...(cuisine ? { cuisine } : {}) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Couldn't load restaurants");
    return { places: body.places as NearbyPlace[], fetchedCuisines: (body.fetchedCuisines ?? []) as CuisineKey[] };
  }

  async function load(pos: Position) {
    setRefreshing(true);
    setError(null);
    try {
      const { places: list, fetchedCuisines: done } = await fetchNearby(pos, filter === "all" ? undefined : filter);
      setPlaces(list);
      setFetchedCuisines(new Set(done));
      setNow(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load restaurants");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!position) return;
    let cancelled = false;
    fetchNearby(position)
      .then(({ places: list, fetchedCuisines: done }) => {
        if (!cancelled) {
          setPlaces(list);
          setFetchedCuisines(new Set(done));
          setError(null);
        }
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load restaurants"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.latitude, position?.longitude]);

  /** Choosing a cuisine filters what's already loaded immediately, and the
   * first choice of a cuisine in this area also runs its own search. */
  async function chooseCuisine(key: Filter) {
    const next = key === filter ? "all" : key;
    setFilter(next);
    if (next === "all" || !position || fetchedCuisines.has(next) || loadingCuisine) return;
    setLoadingCuisine(next);
    try {
      const { places: list, fetchedCuisines: done } = await fetchNearby(position, next);
      setPlaces(list);
      setFetchedCuisines(new Set(done));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load restaurants");
    } finally {
      setLoadingCuisine(null);
    }
  }

  // Waiting for the location answer counts as loading: nothing has been searched yet.
  const loading = refreshing || (locState === "asking" && places === null) || (position !== null && places === null && error === null);

  /** Every place with its live status, filtered and sorted. */
  const ranked = useMemo(() => {
    if (!places) return [];
    const q = query.trim().toLowerCase();
    const withStatus = places
      .filter((p) => filter === "all" || p.cuisine === filter)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.cuisineLabel.toLowerCase().includes(q))
      .map((p) => {
        const status = computeOpenStatus(p.openingPeriods, p.utcOffsetMinutes, now);
        return { place: p, status, happy: computeHappyHour(p.happyHour, p.utcOffsetMinutes, now, closeInfoOf(status)) };
      })
      // Happy Hour shows only places with one running now or starting later today.
      .filter((x) => sort !== "happy" || x.happy.state !== "none");
    const rank = (s: OpenStatus) => (s.state === "open" ? 0 : s.state === "closing_soon" ? 1 : s.state === "unknown" ? 2 : 3);
    withStatus.sort((a, b) => {
      if (sort === "happy") {
        // Running now first (nearest first), then the ones starting later today, soonest first.
        if (a.happy.state !== b.happy.state) return a.happy.state === "active" ? -1 : 1;
        if (a.happy.state === "later" && b.happy.state === "later" && a.happy.startsInMinutes !== b.happy.startsInMinutes) {
          return a.happy.startsInMinutes - b.happy.startsInMinutes;
        }
      } else if (sort === "open") {
        const d = rank(a.status) - rank(b.status);
        if (d !== 0) return d;
      }
      return a.place.distanceMiles - b.place.distanceMiles;
    });
    return withStatus;
  }, [places, filter, query, sort, now]);

  const openPlace = openPlaceId ? (places ?? []).find((p) => p.id === openPlaceId) ?? null : null;

  /** Live status counts for the whole area, independent of the filter. */
  const counts = useMemo(() => {
    let open = 0;
    let closingSoon = 0;
    for (const p of places ?? []) {
      const s = computeOpenStatus(p.openingPeriods, p.utcOffsetMinutes, now);
      if (s.state === "open") open += 1;
      else if (s.state === "closing_soon") closingSoon += 1;
    }
    return { open, closingSoon, total: places?.length ?? 0 };
  }, [places, now]);

  const locationLabel =
    locState === "asking" ? "Locating you…" : locState === "live" ? "Near you" : `Near ${position?.label ?? "…"}`;

  const visibleCuisines = showAllCuisines ? cuisines : cuisines.slice(0, COLLAPSED_TILES);
  const hiddenCount = cuisines.length - COLLAPSED_TILES;
  const activeCuisine = filter === "all" ? null : CUISINE_BY_KEY[filter];

  return (
    <div className="pb-8">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-neutral-950 px-4 pb-5 pt-4 text-neutral-50">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-1/4 -top-1/2 h-[140%] w-[90%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(251,146,60,0.35),transparent_65%)] blur-2xl" />
          <div className="absolute -right-1/4 -top-1/3 h-[120%] w-[80%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.3),transparent_65%)] blur-2xl" />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg shadow-orange-500/30">
              <UtensilsCrossed className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </span>
            <button
              type="button"
              onClick={locate}
              className="inline-flex max-w-[60%] shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-neutral-100 backdrop-blur transition active:scale-95"
            >
              {locState === "live" ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              ) : (
                <LocateFixed className={`h-3.5 w-3.5 shrink-0 ${locState === "asking" ? "animate-pulse" : ""}`} />
              )}
              <span className="truncate">{locationLabel}</span>
            </button>
          </div>

          <h2 className="mt-4 text-[26px] font-bold leading-[1.1] tracking-tight">{config.title || "Real-time food near me"}</h2>
          {config.subtitle && <p className="mt-1.5 text-sm leading-snug text-neutral-300">{config.subtitle}</p>}

          {/* One glass strip of live numbers */}
          <div className="mt-4 min-h-[3.5rem]">
            {places && !loading ? (
              <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 backdrop-blur">
                <Stat value={counts.open} label="Open now" tone="text-emerald-300" dot="bg-emerald-400" />
                <Stat value={counts.closingSoon} label="Closing soon" tone="text-amber-300" dot="bg-amber-400" />
                <Stat value={counts.total} label={`Within ${radius} mi`} tone="text-white" />
              </div>
            ) : loading ? (
              <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
            ) : (
              <p className="text-sm text-neutral-400">
                {locState === "none" ? "Turn on location to see what's open around you." : "No restaurants found nearby."}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── What are you craving? ───────────────────────────────────── */}
      <section className="px-4 pt-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[17px] font-semibold tracking-tight">What are you craving?</h3>
          <span className="text-xs text-muted-foreground">{cuisines.length} cuisines</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <CuisineTile emoji="✨" label="All" active={filter === "all"} onClick={() => chooseCuisine("all")} />
          {visibleCuisines.map((c) => (
            <CuisineTile
              key={c.key}
              emoji={c.emoji}
              label={c.label}
              active={filter === c.key}
              loading={loadingCuisine === c.key}
              onClick={() => chooseCuisine(c.key)}
            />
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllCuisines(!showAllCuisines)}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-muted/40 px-1 py-2.5 text-center transition active:scale-95"
              aria-expanded={showAllCuisines}
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-background text-sm font-semibold shadow-sm">
                {showAllCuisines ? <ChevronDown className="h-4 w-4 rotate-180" /> : `+${hiddenCount}`}
              </span>
              <span className="text-[11px] font-medium leading-tight text-muted-foreground">{showAllCuisines ? "Less" : "More"}</span>
            </button>
          )}
        </div>
      </section>

      {/* ── Sticky search + sort ────────────────────────────────────── */}
      <div className="sticky top-0 z-10 mt-4 border-b border-border/60 bg-background/90 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search restaurants"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <div className="flex shrink-0 rounded-full bg-muted p-0.5 text-xs font-medium">
            {(["open", "distance", "happy"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`whitespace-nowrap rounded-full px-2.5 py-1.5 transition min-[380px]:px-3 ${sort === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {s === "open" ? "Open" : s === "distance" ? "Nearest" : "Happy Hour"}
              </button>
            ))}
          </div>
        </div>
        {activeCuisine && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => chooseCuisine("all")}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
            >
              <span aria-hidden>{activeCuisine.emoji}</span>
              {activeCuisine.label}
              <X className="h-3.5 w-3.5 opacity-70" />
            </button>
            <span className="text-xs text-muted-foreground">
              {loadingCuisine === filter ? "Searching…" : `${ranked.length} ${ranked.length === 1 ? "place" : "places"}`}
            </span>
          </div>
        )}
      </div>

      {/* ── States ──────────────────────────────────────────────────── */}
      <div className="px-4">
        {locState === "none" && (
          <div className="mt-4 rounded-2xl border border-dashed p-6 text-center">
            <Navigation className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Location access is needed to find food near you.</p>
            <button type="button" onClick={locate} className="mt-3 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background">
              Try again
            </button>
          </div>
        )}
        {error && (
          <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {(loading && !places) || (loadingCuisine === filter && ranked.length === 0) ? (
          <ul className="mt-3 space-y-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex animate-pulse items-center gap-3 rounded-2xl border p-3">
                <div className="h-14 w-14 rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-2/5 rounded bg-muted" />
                </div>
              </li>
            ))}
          </ul>
        ) : places && ranked.length === 0 && !loading ? (
          <div className="mt-4 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {query
              ? `Nothing matches "${query}".`
              : sort === "happy"
                ? `No happy hours running right now${activeCuisine ? ` in ${activeCuisine.label}` : ""}. We list the ones restaurants post on their own websites, so some places may be missing.`
                : activeCuisine
                  ? `No ${activeCuisine.label} spots within ${radius} miles.`
                  : `No restaurants within ${radius} miles.`}
          </div>
        ) : null}

        {/* ── Place list ────────────────────────────────────────────── */}
        <ul className="mt-3 space-y-2">
          {ranked.map(({ place, status, happy }, i) => {
            const prev = ranked[i - 1];
            const showClosedHeader = sort === "open" && status.state === "closed" && prev?.status.state !== "closed";
            const showLaterHeader = sort === "happy" && happy.state === "later" && prev?.happy.state !== "later";
            return (
              <li key={place.id}>
                {showClosedHeader && (
                  <p className="mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Closed now</p>
                )}
                {showLaterHeader && (
                  <p className="mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Later today</p>
                )}
                <PlaceCard place={place} status={status} happy={sort === "happy" || happy.state === "active" ? happy : null} onOpen={() => setOpenPlaceId(place.id)} />
              </li>
            );
          })}
        </ul>

        {openPlace && <PlaceSheet place={openPlace} now={now} onClose={() => setOpenPlaceId(null)} />}

        {(places || error) && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => position && load(position)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border bg-background px-4 py-2 text-sm font-medium shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <p className="text-center text-[11px] text-muted-foreground">Hours from Google · open status updates every 30 s</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, tone, dot }: { value: number; label: string; tone: string; dot?: string }) {
  return (
    <div className="px-3 text-center">
      <p className={`text-[22px] font-semibold leading-none tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
        {label}
      </p>
    </div>
  );
}

function CuisineTile({ emoji, label, active, loading, onClick }: { emoji: string; label: string; active: boolean; loading?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-center transition active:scale-95 ${
        active ? "border-transparent bg-foreground text-background shadow-md" : "border-border bg-card"
      }`}
    >
      <span className={`relative grid h-9 w-9 place-items-center rounded-full text-[22px] ${active ? "bg-white/15" : "bg-orange-500/10"}`}>
        <span aria-hidden>{emoji}</span>
        {loading && <RefreshCw className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-spin text-orange-500" />}
      </span>
      <span className="line-clamp-2 text-[11px] font-medium leading-tight">{label}</span>
    </button>
  );
}

/** Reviews already fetched this visit, so reopening doesn't ask again (they are never stored on our side). */
const reviewsCache = new Map<string, PlaceReview[]>();

function Stars({ rating, className = "h-3.5 w-3.5" }: { rating: number; className?: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${className} ${n <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-transparent text-foreground/25"}`} aria-hidden />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: PlaceReview }) {
  const [more, setMore] = useState(false);
  const long = review.text.length > 220;
  const name = review.authorUrl ? (
    <a href={review.authorUrl} target="_blank" rel="noreferrer" className="truncate font-semibold underline-offset-2 hover:underline">
      {review.author}
    </a>
  ) : (
    <span className="truncate font-semibold">{review.author}</span>
  );
  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-3">
        {review.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.photoUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-10 w-10 shrink-0 rounded-full bg-muted object-cover" />
        ) : (
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-500/15 text-sm font-bold text-orange-700 dark:text-orange-300">
            {review.author.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 text-[15px]">{name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Stars rating={review.rating} />
            {review.when && <span>{review.when}</span>}
          </p>
        </div>
      </div>
      <p className={`mt-3 whitespace-pre-line text-[15px] leading-snug ${long && !more ? "line-clamp-5" : ""}`}>{review.text}</p>
      {long && (
        <button type="button" onClick={() => setMore(!more)} className="mt-1.5 text-sm font-semibold text-orange-600 dark:text-orange-400">
          {more ? "Less" : "More"}
        </button>
      )}
    </li>
  );
}

/**
 * Google's most relevant reviews for one restaurant, fetched live when the viewer taps its rating (/food/reviews). Google only
 * hands out its top few, so the screen always offers the full list on Google Maps, which is also what shows when the monthly
 * free allowance is used up or Google doesn't answer.
 */
function ReviewsPanel({ place, onBack }: { place: NearbyPlace; onBack: () => void }) {
  const [reviews, setReviews] = useState<PlaceReview[] | null | undefined>(() => reviewsCache.get(place.id)); // undefined = loading, null = unavailable
  const googleUrl = mapsPlaceUrl(place.name, place.googlePlaceId);

  useEffect(() => {
    if (reviewsCache.has(place.id)) return;
    const ctrl = new AbortController();
    fetch("/food/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: place.id }),
      signal: ctrl.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { status?: string; reviews?: PlaceReview[] } | null) => {
        if (body?.status === "ok" && Array.isArray(body.reviews)) {
          reviewsCache.set(place.id, body.reviews);
          setReviews(body.reviews);
        } else {
          setReviews(null);
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setReviews(null);
      });
    return () => ctrl.abort();
  }, [place.id]);

  const total = place.ratingCount;
  const seeAll = (
    <a
      href={googleUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-foreground/10 px-4 text-[15px] font-semibold active:bg-foreground/20"
    >
      <MapPin className="h-5 w-5" aria-hidden />
      {total !== null ? `See all ${total.toLocaleString()} reviews on Google Maps` : "See all reviews on Google Maps"}
    </a>
  );

  return (
    <div className="absolute inset-0 z-10 mx-auto flex w-full max-w-md flex-col bg-background" role="region" aria-label={`${place.name} reviews`}>
      <div className="flex shrink-0 items-center gap-1 border-b px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onBack} className="inline-flex h-11 items-center gap-0.5 rounded-full pl-1 pr-3 text-[16px] font-semibold text-orange-600 active:bg-foreground/10 dark:text-orange-400">
          <ChevronLeft className="h-6 w-6" aria-hidden /> Back
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[15px] font-bold leading-tight">Reviews</p>
          <p className="truncate text-xs text-muted-foreground">{place.name}</p>
        </div>
        <span className="w-14" aria-hidden />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        {place.rating !== null && (
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold tabular-nums leading-none">{place.rating.toFixed(1)}</span>
            <div>
              <Stars rating={place.rating} className="h-4 w-4" />
              {total !== null && <p className="mt-1 text-xs text-muted-foreground">{total.toLocaleString()} reviews on Google</p>}
            </div>
          </div>
        )}

        {reviews === undefined && (
          <ul className="mt-4 space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="animate-pulse rounded-2xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-foreground/10" />
                  <div className="h-3.5 w-28 rounded bg-foreground/10" />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-full rounded bg-foreground/10" />
                  <div className="h-3 w-4/5 rounded bg-foreground/10" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {reviews && reviews.length > 0 && (
          <>
            <p className="mt-4 text-xs text-muted-foreground">Google&apos;s most relevant reviews for this place.</p>
            <ul className="mt-2 space-y-3">
              {reviews.map((r, i) => (
                <ReviewCard key={`${r.author}-${i}`} review={r} />
              ))}
            </ul>
          </>
        )}

        {reviews !== undefined && (!reviews || reviews.length === 0) && (
          <div className="mt-6 rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            {reviews === null ? "Reviews can't be shown here right now." : "Google has no written reviews to show for this place."} Everything is on Google Maps.
          </div>
        )}

        {reviews !== undefined && seeAll}
        {reviews !== undefined && <p className="mt-3 text-center text-[11px] text-muted-foreground">Reviews from Google</p>}
      </div>
    </div>
  );
}

/** Dishes already fetched this visit, so reopening a sheet doesn't ask again. */
const dishCache = new Map<string, PopularDish[]>();

type MenuInfo =
  | { status: "ok"; embeddable: true; url: string; host: string; kind: "menu" | "site" }
  | { status: "ok"; embeddable: false; kind?: undefined }
  | { status: "ok"; embeddable: false; kind: "items"; sections: MenuSection[]; sourceUrl: string | null; host: string | null; asOf: string | null; fromPhoto?: boolean };
/** Menu lookups already done this visit. */
const menuCache = new Map<string, MenuInfo>();

// Apple Maps-style tile: icon over a short label, so up to four fit across any phone.
const actionTile =
  "flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-foreground/10 px-1 py-2 text-xs font-semibold transition active:scale-[0.97] active:bg-foreground/20";

/** Google Maps directions to a place in the given travel mode. */
function directionsUrl(place: NearbyPlace, mode: TravelMode): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&destination_place_id=${encodeURIComponent(place.googlePlaceId)}&travelmode=${mode}`;
}

function PlaceCard({ place, status, happy, onOpen }: { place: NearbyPlace; status: OpenStatus; happy: HappyHourStatus | null; onOpen: () => void }) {
  const closed = status.state === "closed";
  const emoji = place.cuisine ? CUISINE_BY_KEY[place.cuisine].emoji : "🍽️";
  // Like Apple Maps' travel-time button: walk when it's short, otherwise drive. Both are estimates.
  const travel = travelEstimate(place.distanceMiles);
  return (
    // Tapping the card opens the details sheet; the orange button goes straight to directions.
    <div
      className={`relative flex items-center gap-3 rounded-2xl border bg-card p-3 transition active:scale-[0.99] ${
        closed ? "opacity-55" : status.state === "closing_soon" ? "border-amber-400/60" : "shadow-sm"
      }`}
    >
      <button type="button" onClick={onOpen} aria-label={`Details for ${place.name}`} className="absolute inset-0 rounded-2xl" />
      <div className={`pointer-events-none grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-[28px] ${closed ? "grayscale" : ""} ${avatarColor(place.id)}`}>
        <span aria-hidden>{emoji}</span>
      </div>

      <div className="pointer-events-none min-w-0 flex-1">
        <p className="min-w-0 truncate text-[15px] font-semibold leading-tight">{place.name}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{place.cuisineLabel}</span>
          {place.rating !== null && (
            <>
              <span aria-hidden>·</span>
              <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              <span className="font-medium text-foreground/80">{place.rating.toFixed(1)}</span>
            </>
          )}
          {place.priceLevel !== null && place.priceLevel > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{"$".repeat(place.priceLevel)}</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="shrink-0 tabular-nums">{distanceLabel(place.distanceMiles)}</span>
        </p>
        {happy && happy.state !== "none" && (
          <p className="mt-1 flex min-w-0 items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <span aria-hidden>🍻</span>
            <span className="min-w-0 truncate">
              {happy.state === "active" ? `Happy hour ${happyEndsLabel(happy)}` : `Happy hour at ${happy.startsAtLabel}`}
              {happy.deal && <span className="font-normal text-muted-foreground"> · {happy.deal}</span>}
            </span>
          </p>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <StatusLine status={status} />
          <a
            href={directionsUrl(place, travel.mode)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Directions to ${place.name}, about ${travel.minutes} minutes ${travel.mode === "walking" ? "on foot" : "by car"}`}
            className="pointer-events-auto relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-500/12 px-3 py-1.5 text-[13px] font-semibold text-orange-700 tabular-nums transition active:scale-95 dark:bg-orange-400/15 dark:text-orange-300"
          >
            <span aria-hidden className="text-[15px] leading-none">{travel.mode === "walking" ? "🚶" : "🚗"}</span>
            {travel.label}
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * The details sheet (Apple Maps style): slides up over the list, drag down / tap outside / Escape
 * to close. Everything here comes from data we already have, so it opens instantly.
 */
function PlaceSheet({ place, now, onClose }: { place: NearbyPlace; now: Date; onClose: () => void }) {
  const status = computeOpenStatus(place.openingPeriods, place.utcOffsetMinutes, now);
  const emoji = place.cuisine ? CUISINE_BY_KEY[place.cuisine].emoji : "🍽️";
  const rows = hoursRows(place.weekdayDescriptions, now, place.utcOffsetMinutes);
  const best = travelEstimate(place.distanceMiles).mode;
  const tel = telHref(place.phoneInternational);
  const website = safeWebsite(place.website);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const reviewsOpenRef = useRef(false);
  useEffect(() => {
    reviewsOpenRef.current = reviewsOpen;
  }, [reviewsOpen]);
  /** undefined = still loading; [] = nothing to show (no data, cap reached, or an error): the section is left out. */
  const [dishes, setDishes] = useState<PopularDish[] | undefined>(() => dishCache.get(place.id));
  const startY = useRef<number | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);

  function close() {
    if (closing.current) return;
    closing.current = true;
    setShown(false);
    setDragY(0);
    window.setTimeout(onClose, 220);
  }

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const raf = window.requestAnimationFrame(() => setShown(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (reviewsOpenRef.current) setReviewsOpen(false); // Escape backs out of reviews or the menu first
      else if (menuOpenRef.current) setMenuOpen(false);
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dishCache.has(place.id)) return;
    const ctrl = new AbortController();
    fetch("/food/dishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: place.id }),
      signal: ctrl.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { status?: string; dishes?: PopularDish[] } | null) => {
        const list = body?.status === "ok" && Array.isArray(body.dishes) ? body.dishes : [];
        if (body?.status === "ok") dishCache.set(place.id, list); // don't remember a miss: try again next time
        setDishes(list);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setDishes([]);
      });
    return () => ctrl.abort();
  }, [place.id]);

  async function copyAddress() {
    if (!place.address) return;
    try {
      await navigator.clipboard.writeText(place.address);
    } catch {
      // Clipboard blocked: the address is shown as text, so it can still be selected by hand.
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const modeButton = (mode: TravelMode) => {
    const isBest = mode === best;
    const minutes = mode === "walking" ? walkMinutes(place.distanceMiles) : driveMinutes(place.distanceMiles);
    const label = mode === "walking" ? `~${walkLabel(place.distanceMiles)}` : `~${minutes} min`;
    return (
      <a
        href={directionsUrl(place, mode)}
        target="_blank"
        rel="noreferrer"
        className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold tabular-nums transition active:scale-[0.98] ${
          isBest ? "bg-orange-500 text-white" : "bg-orange-500/12 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300"
        }`}
      >
        <span aria-hidden className="text-lg leading-none">{mode === "walking" ? "🚶" : "🚗"}</span>
        <span className="flex flex-col items-start leading-tight">
          <span>{mode === "walking" ? "Walk" : "Drive"}</span>
          <span className="text-[13px] font-medium opacity-90">{label}</span>
        </span>
      </a>
    );
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${place.name} details`}>
      <button
        type="button"
        aria-label="Close details"
        tabIndex={-1}
        onClick={close}
        className={`absolute inset-0 bg-black/45 transition-opacity duration-200 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-background shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: shown ? `translateY(${dragY}px)` : "translateY(100%)", transitionDuration: dragY ? "0ms" : undefined }}
      >
        {/* Grabber + title: dragging this part down closes the sheet. */}
        <div
          className="touch-none px-5 pt-2"
          onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
          onTouchMove={(e) => {
            if (startY.current !== null) setDragY(Math.max(0, e.touches[0].clientY - startY.current));
          }}
          onTouchEnd={() => {
            if (dragY > 90) close();
            else setDragY(0);
            startY.current = null;
          }}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-foreground/20" />
          <div className="mt-3 flex items-start gap-3">
            <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-[28px] ${avatarColor(place.id)}`}>
              <span aria-hidden>{emoji}</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="text-[20px] font-bold leading-tight">{place.name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                <span>{place.cuisineLabel}</span>
                {place.rating !== null && (
                  <>
                    <span aria-hidden>·</span>
                    {/* Tapping the rating opens Google's reviews for this place (ReviewsPanel). */}
                    <button
                      type="button"
                      onClick={() => setReviewsOpen(true)}
                      aria-label={`Read reviews for ${place.name}, rated ${place.rating.toFixed(1)}${place.ratingCount !== null ? ` from ${place.ratingCount.toLocaleString()} reviews` : ""}`}
                      className="-my-1 inline-flex items-center gap-1 rounded-full bg-foreground/[0.07] py-1 pl-1.5 pr-1 transition active:bg-foreground/15"
                    >
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-medium text-foreground/80">{place.rating.toFixed(1)}</span>
                      {place.ratingCount !== null && <span>({place.ratingCount.toLocaleString()})</span>}
                      <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    </button>
                  </>
                )}
                {place.priceLevel !== null && place.priceLevel > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{"$".repeat(place.priceLevel)}</span>
                  </>
                )}
              </p>
            </div>
            <button
              ref={closeButton}
              type="button"
              onClick={close}
              aria-label="Close"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-foreground/10 text-foreground/70 active:bg-foreground/20"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          <div className="text-[15px]">
            <StatusLine status={status} />
          </div>

          <div className="mt-4 flex gap-3">
            {modeButton("walking")}
            {modeButton("driving")}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {distanceLabel(place.distanceMiles)} away · times are estimates, Google Maps shows the exact route
          </p>

          {/* Call and Website appear when Google has them. Menu opens the restaurant's own menu inside the app (MenuPanel); Maps is a plain Google link to the place page (phone, website, menu, photos and reviews). Both are always there and free. */}
          <div className="mt-4 flex gap-2.5">
            {tel && (
              <a href={tel} className={actionTile}>
                <Phone className="h-5 w-5" aria-hidden /> Call
              </a>
            )}
            {website && (
              <a href={website} target="_blank" rel="noreferrer" className={actionTile}>
                <Globe className="h-5 w-5" aria-hidden /> Website
              </a>
            )}
            <button type="button" onClick={() => setMenuOpen(true)} className={actionTile}>
              <BookOpen className="h-5 w-5" aria-hidden /> Menu
            </button>
            <a href={mapsPlaceUrl(place.name, place.googlePlaceId)} target="_blank" rel="noreferrer" className={actionTile}>
              <MapPin className="h-5 w-5" aria-hidden /> Maps
            </a>
          </div>

          {/* Happy hours the restaurant posts on its own website (read by the menu job); left out when none were found. */}
          {place.happyHour.length > 0 && (
            <section className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Happy hour</h3>
              <ul className="mt-2 divide-y rounded-2xl border bg-card">
                {place.happyHour.map((w, i) => (
                  <li key={i} className="px-4 py-2.5 text-[15px]">
                    <div className="flex items-center justify-between gap-3 tabular-nums">
                      <span className="font-semibold">{daysLabel(w.days)}</span>
                      <span>{windowTimeLabel(w)}</span>
                    </div>
                    {w.deal && <p className="mt-0.5 text-sm text-muted-foreground">{w.deal}</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">From the restaurant&apos;s website · may be out of date</p>
            </section>
          )}

          {/* Dishes reviewers mention. Skeleton while it loads; the whole section goes away if there's nothing to show. */}
          {dishes === undefined && (
            <section className="mt-6" aria-hidden>
              <div className="h-3 w-40 animate-pulse rounded bg-foreground/10" />
              <div className="mt-2 divide-y rounded-2xl border bg-card">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-8 w-8 animate-pulse rounded-xl bg-foreground/10" />
                    <div className="h-3.5 w-32 animate-pulse rounded bg-foreground/10" />
                  </div>
                ))}
              </div>
            </section>
          )}
          {dishes && dishes.length > 0 && (
            <section className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Popular with diners</h3>
              <ul className="mt-2 divide-y rounded-2xl border bg-card">
                {dishes.map((dish) => (
                  <li key={dish.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-xl">
                      {dish.emoji}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{dish.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {dish.mentions} {dish.mentions === 1 ? "review" : "reviews"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">Mentioned in recent 4★ and 5★ Google reviews</p>
            </section>
          )}

          {rows.length > 0 && (
            <section className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hours</h3>
              <ul className="mt-2 divide-y rounded-2xl border bg-card">
                {rows.map((r) => (
                  <li key={r.day} className={`flex items-center justify-between gap-3 px-4 py-2.5 text-[15px] tabular-nums ${r.today ? "bg-orange-500/10 font-semibold" : ""}`}>
                    <span>{r.day}</span>
                    <span className={r.today ? "" : "text-muted-foreground"}>{r.hours}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">Hours from Google</p>
            </section>
          )}

          {place.address && (
            <section className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</h3>
              <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
                <p className="min-w-0 text-[15px] leading-snug">{place.address}</p>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-foreground/10 px-3.5 text-sm font-semibold active:bg-foreground/20"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
      {/* Outside the sliding sheet on purpose: a fixed panel inside a transformed element would be clipped to it. */}
      {menuOpen && <MenuPanel place={place} dishes={dishes} onBack={() => setMenuOpen(false)} />}
      {reviewsOpen && <ReviewsPanel place={place} onBack={() => setReviewsOpen(false)} />}
    </div>
  );
}

/**
 * The restaurant's own menu, shown inside the app. Google has no menu data, so the server finds the menu page
 * on the restaurant's website and checks that the site allows being shown here (lib/food/menuLookup.ts).
 * About half of restaurants do. For the rest we say so plainly, show the dishes we have, and offer the ways out
 * clearly labelled as opening your browser.
 */
function MenuPanel({ place, dishes, onBack }: { place: NearbyPlace; dishes: PopularDish[] | undefined; onBack: () => void }) {
  const [info, setInfo] = useState<MenuInfo | null | undefined>(() => menuCache.get(place.id)); // undefined = loading, null = failed
  const website = safeWebsite(place.website);

  useEffect(() => {
    if (menuCache.has(place.id)) return;
    const ctrl = new AbortController();
    fetch("/food/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: place.id }),
      signal: ctrl.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: MenuInfo | null) => {
        if (body?.status === "ok") menuCache.set(place.id, body);
        setInfo(body?.status === "ok" ? body : null);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setInfo(null);
      });
    return () => ctrl.abort();
  }, [place.id]);

  const embedded = info?.embeddable ? info : null;
  const saved = info && info.kind === "items" ? info : null;
  return (
    <div className="absolute inset-0 z-10 mx-auto flex w-full max-w-md flex-col bg-background" role="region" aria-label={`${place.name} menu`}>
      <div className="flex shrink-0 items-center gap-1 border-b px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onBack} className="inline-flex h-11 items-center gap-0.5 rounded-full pl-1 pr-3 text-[16px] font-semibold text-orange-600 active:bg-foreground/10 dark:text-orange-400">
          <ChevronLeft className="h-6 w-6" aria-hidden /> Back
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[15px] font-bold leading-tight">Menu</p>
          <p className="truncate text-xs text-muted-foreground">{place.name}</p>
        </div>
        {embedded || saved?.sourceUrl ? (
          <a
            href={embedded ? embedded.url : saved!.sourceUrl!}
            target="_blank"
            rel="noreferrer"
            aria-label="Open this page in your browser"
            className="grid h-11 w-14 place-items-center rounded-full text-foreground/70 active:bg-foreground/10"
          >
            <ExternalLink className="h-5 w-5" aria-hidden />
          </a>
        ) : (
          <span className="w-14" aria-hidden />
        )}
      </div>

      {info === undefined && (
        <div className="grid flex-1 place-items-center" role="status">
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            Finding the menu…
          </div>
        </div>
      )}

      {embedded && (
        <>
          <p className="shrink-0 bg-foreground/5 px-4 py-2 text-xs text-muted-foreground">
            {embedded.kind === "menu" ? `Menu from ${embedded.host}` : `We couldn't find a menu page, so this is ${embedded.host}. Look for their menu link.`}
          </p>
          {/* sandbox: the page can run and use forms, but cannot navigate our app away or reach our data. */}
          <iframe
            src={embedded.url}
            title={`${place.name} menu`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            className="min-h-0 w-full flex-1 border-0 bg-white"
          />
        </>
      )}

      {saved && <SavedMenu menu={saved} />}

      {info !== undefined && !embedded && !saved && (
        <div className="flex-1 overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
          <div className="text-center">
            <div aria-hidden className="text-4xl">📖</div>
            <h2 className="mt-3 text-lg font-bold">This menu can&apos;t be shown here</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {place.website ? `${place.name}'s website doesn't allow its menu to be shown inside other apps.` : `${place.name} hasn't listed a website.`}
            </p>
          </div>

          {dishes && dishes.length > 0 && (
            <section className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Popular with diners</h3>
              <ul className="mt-2 divide-y rounded-2xl border bg-card">
                {dishes.map((dish) => (
                  <li key={dish.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-xl">{dish.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{dish.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">These open in your browser, outside this app:</p>
          <div className="mt-2 flex gap-2.5">
            <a href={menuSearchUrl(place.name, place.address)} target="_blank" rel="noreferrer" className={actionTile}>
              <ExternalLink className="h-5 w-5" aria-hidden /> Search for the menu
            </a>
            {website && (
              <a href={website} target="_blank" rel="noreferrer" className={actionTile}>
                <Globe className="h-5 w-5" aria-hidden /> Restaurant website
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const asOfLabel = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

/**
 * The menu read from the restaurant's own page by the job on the owner's Mac (tools/menu-ingest), shown in our own
 * screen: section shortcuts, a search box, then dishes with prices and descriptions. It says where it came from and
 * when, because a menu read from a web page can be out of date.
 */
function SavedMenu({ menu }: { menu: Extract<MenuInfo, { kind: "items" }> }) {
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const sections = filterMenu(menu.sections, query);
  const when = asOfLabel(menu.asOf);
  const count = menu.sections.reduce((n, s) => n + s.items.length, 0);

  function jump(index: number) {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-section="${index}"]`);
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <>
      <p className="shrink-0 bg-foreground/5 px-4 py-2 text-xs text-muted-foreground">
        {menu.host ? `From ${menu.host}` : "From the restaurant's website"}
        {when ? ` · saved ${when}` : ""}
      </p>
      <div className="shrink-0 px-4 pb-2 pt-3">
        <label className="flex h-11 items-center gap-2 rounded-xl bg-foreground/10 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${count} dishes`}
            aria-label="Search this menu"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </label>
        {!query && menu.sections.length >= 3 && (
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1" role="navigation" aria-label="Menu sections">
            {menu.sections.map((s, i) => (
              <button
                key={`${s.name}-${i}`}
                type="button"
                onClick={() => jump(i)}
                className="h-9 shrink-0 rounded-full bg-orange-500/12 px-3.5 text-[13px] font-semibold text-orange-700 active:bg-orange-500/25 dark:bg-orange-400/15 dark:text-orange-300"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {sections.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No dishes match &ldquo;{query}&rdquo;.</p>}
        {sections.map((s, i) => (
          <section key={`${s.name}-${i}`} data-section={i} className="pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.name}</h3>
            <ul className="mt-2 divide-y rounded-2xl border bg-card">
              {s.items.map((item, j) => (
                <li key={`${item.name}-${j}`} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-[15px] font-semibold leading-snug">{item.name}</span>
                    {item.price && <span className="shrink-0 text-[15px] font-medium tabular-nums">{item.price}</span>}
                  </div>
                  {item.description && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{item.description}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="pt-5 text-center text-xs leading-relaxed text-muted-foreground">
          {menu.fromPhoto ? "Read from a photo of the restaurant's menu" : "Read from the restaurant's website"}
          {when ? ` on ${when}` : ""}. {menu.fromPhoto ? "A price can be misread from a photo, and dishes may have changed, so check with the restaurant." : "Dishes and prices may have changed, so check with the restaurant."}
        </p>
      </div>
    </>
  );
}

function StatusLine({ status }: { status: OpenStatus }) {
  if (status.state === "open") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="truncate">
          Open<span className="font-normal text-muted-foreground">{status.closesAtLabel ? ` · until ${status.closesAtLabel}` : " · 24 hours"}</span>
        </span>
      </span>
    );
  }
  if (status.state === "closing_soon") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Closes in {status.closesInMinutes} min</span>
      </span>
    );
  }
  if (status.state === "closed") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
        <span className="truncate">
          Closed<span className="font-normal text-muted-foreground">{status.opensAtLabel ? ` · opens ${status.opensAtLabel}` : ""}</span>
        </span>
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Hours unknown</span>;
}
