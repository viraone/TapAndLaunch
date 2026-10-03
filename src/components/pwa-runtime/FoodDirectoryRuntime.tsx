"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Clock, Footprints, LocateFixed, Navigation, RefreshCw, Search, Star, UtensilsCrossed, X } from "lucide-react";
import type { CuisineKey, FoodDirectoryBlockConfig } from "@/types/database";
import type { NearbyPlace } from "@/lib/food/nearby";
import { CUISINES, CUISINE_BY_KEY } from "@/lib/food/cuisines";
import { computeOpenStatus, type OpenStatus } from "@/lib/food/hours";
import { walkLabel } from "@/lib/food/walk";

type Position = { latitude: number; longitude: number; label: string; live: boolean };
type Filter = "all" | CuisineKey;

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
  const [showAllCuisines, setShowAllCuisines] = useState(false);
  /** Cuisines whose own Google search is confirmed for the current position. */
  const [fetchedCuisines, setFetchedCuisines] = useState<Set<CuisineKey>>(() => new Set());
  const [loadingCuisine, setLoadingCuisine] = useState<CuisineKey | null>(null);
  const [sort, setSort] = useState<"distance" | "open">(config.default_sort ?? "open");
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
      .map((p) => ({ place: p, status: computeOpenStatus(p.openingPeriods, p.utcOffsetMinutes, now) }));
    const rank = (s: OpenStatus) => (s.state === "open" ? 0 : s.state === "closing_soon" ? 1 : s.state === "unknown" ? 2 : 3);
    withStatus.sort((a, b) => {
      if (sort === "open") {
        const d = rank(a.status) - rank(b.status);
        if (d !== 0) return d;
      }
      return a.place.distanceMiles - b.place.distanceMiles;
    });
    return withStatus;
  }, [places, filter, query, sort, now]);

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
              placeholder="Search restaurants"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <div className="flex shrink-0 rounded-full bg-muted p-0.5 text-xs font-medium">
            {(["open", "distance"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1.5 transition ${sort === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {s === "open" ? "Open" : "Nearest"}
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
              : activeCuisine
                ? `No ${activeCuisine.label} spots within ${radius} miles.`
                : `No restaurants within ${radius} miles.`}
          </div>
        ) : null}

        {/* ── Place list ────────────────────────────────────────────── */}
        <ul className="mt-3 space-y-2">
          {ranked.map(({ place, status }, i) => {
            const prev = ranked[i - 1]?.status.state;
            const showClosedHeader = sort === "open" && status.state === "closed" && prev !== "closed";
            return (
              <li key={place.id}>
                {showClosedHeader && (
                  <p className="mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Closed now</p>
                )}
                <PlaceCard place={place} status={status} />
              </li>
            );
          })}
        </ul>

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

function PlaceCard({ place, status }: { place: NearbyPlace; status: OpenStatus }) {
  const closed = status.state === "closed";
  const emoji = place.cuisine ? CUISINE_BY_KEY[place.cuisine].emoji : "🍽️";
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&destination_place_id=${encodeURIComponent(place.googlePlaceId)}&travelmode=walking`;
  const walk = walkLabel(place.distanceMiles);
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 rounded-2xl border bg-card p-3 transition active:scale-[0.99] ${
        closed ? "opacity-55" : status.state === "closing_soon" ? "border-amber-400/60" : "shadow-sm"
      }`}
    >
      <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-[28px] ${closed ? "grayscale" : ""} ${avatarColor(place.id)}`}>
        <span aria-hidden>{emoji}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-[15px] font-semibold leading-tight">{place.name}</p>
          <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{distanceLabel(place.distanceMiles)}</span>
        </div>
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
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <StatusLine status={status} />
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
            <span className="inline-flex items-center gap-1 tabular-nums" aria-label={`About ${walk} on foot`}>
              <Footprints className="h-3 w-3" aria-hidden /> {walk}
            </span>
            <span aria-hidden className="h-3 w-px bg-foreground/20" />
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-3 w-3" /> Go
            </span>
          </span>
        </div>
      </div>
    </a>
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
