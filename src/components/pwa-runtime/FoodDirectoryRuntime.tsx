"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Clock, LocateFixed, MapPin, Navigation, RefreshCw, Star, Timer, Users, UtensilsCrossed, X } from "lucide-react";
import type { CuisineKey, FoodDirectoryBlockConfig } from "@/types/database";
import type { NearbyPlace } from "@/lib/food/nearby";
import { CUISINES, CUISINE_BY_KEY } from "@/lib/food/cuisines";
import { computeOpenStatus, type OpenStatus } from "@/lib/food/hours";

type Position = { latitude: number; longitude: number; label: string; live: boolean };
type Filter = "all" | CuisineKey;

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function waitLabel(minutes: number): string {
  if (minutes <= 0) return "No wait";
  if (minutes >= 45) return "45+ min wait";
  return `${minutes} min wait`;
}

const WAIT_OPTIONS = [0, 5, 10, 15, 20, 30, 45];

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

/**
 * LiveBites. Asks the browser for the viewer's position once, loads the
 * restaurants our server has for that spot (Google Places, cached a day —
 * see lib/food/nearby.ts), and computes open / closing soon / closed from
 * each place's hours *right now*, re-evaluating every 30 s so countdowns
 * stay honest without any network traffic.
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
  const [sort, setSort] = useState<"distance" | "open">(config.default_sort ?? "open");
  const [now, setNow] = useState(() => new Date());
  const [reporting, setReporting] = useState<NearbyPlace | null>(null);

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

  // Re-evaluate open/closed twice a minute so "Closing in N min" ticks.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  async function fetchNearby(pos: Position): Promise<NearbyPlace[]> {
    const res = await fetch("/food/nearby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: pos.latitude, longitude: pos.longitude, radiusMiles: radius }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Couldn't load restaurants");
    return body.places as NearbyPlace[];
  }

  async function load(pos: Position) {
    setRefreshing(true);
    setError(null);
    try {
      setPlaces(await fetchNearby(pos));
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
      .then((list) => { if (!cancelled) { setPlaces(list); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load restaurants"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.latitude, position?.longitude]);

  const loading = refreshing || (position !== null && places === null && error === null);

  /** Every place with its live status, filtered and sorted. */
  const ranked = useMemo(() => {
    if (!places) return [];
    const withStatus = places
      .filter((p) => filter === "all" || p.cuisine === filter)
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
  }, [places, filter, sort, now]);

  const counts = useMemo(() => {
    let open = 0;
    let closingSoon = 0;
    for (const { status } of ranked) {
      if (status.state === "open") open += 1;
      else if (status.state === "closing_soon") closingSoon += 1;
    }
    return { open, closingSoon, total: ranked.length };
  }, [ranked]);

  const locationLabel =
    locState === "asking" ? "Locating you…" : locState === "live" ? "Near you" : `Near ${position?.label ?? "…"}`;

  return (
    <div className="pb-6">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-neutral-950 px-4 pb-5 pt-4 text-neutral-50">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-1/4 -top-1/2 h-[140%] w-[90%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(251,146,60,0.35),transparent_65%)] blur-2xl" />
          <div className="absolute -right-1/4 -top-1/3 h-[120%] w-[80%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.3),transparent_65%)] blur-2xl" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_80%)]" />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-lg shadow-orange-500/30">
                <UtensilsCrossed className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <span className="truncate">{config.title || "Real-time food near me"}</span>
            </h2>
            <button
              type="button"
              onClick={locate}
              className="inline-flex max-w-[50%] shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-neutral-200 backdrop-blur transition hover:bg-white/10"
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
          {config.subtitle && <p className="mt-2 text-sm leading-snug text-neutral-300">{config.subtitle}</p>}

          {/* Live counters */}
          <div className="mt-4 min-h-[3.25rem]">
            {places && !loading ? (
              <div className="flex items-stretch gap-2">
                <div className="flex-1 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 backdrop-blur">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300/80">Open now</p>
                  <p className="text-2xl font-semibold leading-none text-emerald-300 tabular-nums">{counts.open}</p>
                </div>
                <div className="flex-1 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 backdrop-blur">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-amber-300/80">Closing soon</p>
                  <p className="text-2xl font-semibold leading-none text-amber-300 tabular-nums">{counts.closingSoon}</p>
                </div>
                <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">Within {radius} mi</p>
                  <p className="text-2xl font-semibold leading-none text-neutral-100 tabular-nums">{counts.total}</p>
                </div>
              </div>
            ) : loading ? (
              <div className="flex animate-pulse gap-2">
                {[0, 1, 2].map((i) => <div key={i} className="h-[3.25rem] flex-1 rounded-xl bg-white/10" />)}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">
                {locState === "none" ? "Turn on location to see what's open around you." : "No restaurants found nearby."}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Sticky controls ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none]">
            <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>All</FilterPill>
            {cuisines.map((c) => (
              <FilterPill key={c.key} active={filter === c.key} onClick={() => setFilter(c.key)}>
                <span aria-hidden className="mr-1">{c.emoji}</span>{c.label}
              </FilterPill>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSort(sort === "distance" ? "open" : "distance")}
            aria-label={`Sorted by ${sort === "distance" ? "distance" : "open first"}; tap to switch`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            {sort === "distance" ? "Nearest" : "Open first"}
          </button>
        </div>
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

        {loading && !places && (
          <ul className="mt-3 space-y-2.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex animate-pulse items-center gap-3 rounded-2xl border p-3.5">
                <div className="h-12 w-12 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/2 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="h-5 w-2/5 rounded-full bg-muted" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {places && ranked.length === 0 && !loading && (
          <div className="mt-4 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {filter === "all" ? `No restaurants within ${radius} miles.` : `No ${CUISINE_BY_KEY[filter].label} spots within ${radius} miles.`}
          </div>
        )}

        {/* ── Place list ────────────────────────────────────────────── */}
        <ul className="mt-3 space-y-2.5">
          {ranked.map(({ place, status }) => {
            const closed = status.state === "closed";
            const emoji = place.cuisine ? CUISINE_BY_KEY[place.cuisine].emoji : "🍽️";
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}&destination_place_id=${encodeURIComponent(place.googlePlaceId)}`;
            return (
              <li
                key={place.id}
                className={`relative overflow-hidden rounded-2xl border bg-card p-3.5 transition ${
                  closed ? "opacity-60 saturate-50" : status.state === "closing_soon" ? "border-amber-400/50 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]" : "shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-2xl shadow-inner ${avatarColor(place.id)}`}>
                    <span aria-hidden>{emoji}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{place.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <span>{place.cuisineLabel}</span>
                      {place.rating !== null && (
                        <span className="inline-flex items-center gap-0.5">
                          · <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {place.rating.toFixed(1)}
                          {place.ratingCount !== null && <span className="text-muted-foreground/70">({place.ratingCount})</span>}
                        </span>
                      )}
                      {place.priceLevel !== null && place.priceLevel > 0 && <span>· {"$".repeat(place.priceLevel)}</span>}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={status} wait={place.wait} />
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {place.distanceMiles.toFixed(1)} mi
                      </span>
                    </div>
                    {place.wait && status.state !== "closed" && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Wait reported {timeAgo(place.wait.reportedAt)}</p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Directions
                  </a>
                  <button
                    type="button"
                    onClick={() => setReporting(place)}
                    disabled={closed}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-40"
                  >
                    <Timer className="h-3.5 w-3.5" /> Report wait
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {(places || error) && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => position && load(position)}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Hours from Google · wait times from diners like you · status updates every 30s
            </p>
          </div>
        )}
      </div>

      {reporting && (
        <WaitReportSheet
          place={reporting}
          onClose={() => setReporting(null)}
          onSaved={() => { setReporting(null); if (position) void load(position); }}
        />
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
        active ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status, wait }: { status: OpenStatus; wait: NearbyPlace["wait"] }) {
  if (status.state === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Open{wait ? ` · ${waitLabel(wait.minutes)}` : status.closesAtLabel ? ` · until ${status.closesAtLabel}` : " · 24 hours"}
      </span>
    );
  }
  if (status.state === "closing_soon") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400">
        <Clock className="h-3 w-3" />
        Closing in {status.closesInMinutes} min{wait ? ` · ${waitLabel(wait.minutes)}` : ""}
      </span>
    );
  }
  if (status.state === "closed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-inset ring-red-500/30 dark:text-red-400">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        Closed{status.opensAtLabel ? ` · Opens ${status.opensAtLabel}` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
      Hours unknown{wait ? ` · ${waitLabel(wait.minutes)}` : ""}
    </span>
  );
}

function WaitReportSheet({ place, onClose, onSaved }: { place: NearbyPlace; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function submit(minutes: number) {
    setStatus("saving");
    const res = await fetch("/food/wait", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: place.id, waitMinutes: minutes }),
    });
    if (!res.ok) { setStatus("error"); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border-t bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight">How long is the wait?</h3>
            <p className="truncate text-sm text-muted-foreground">{place.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {WAIT_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              disabled={status === "saving"}
              onClick={() => submit(m)}
              className={`rounded-xl border px-2 py-3 text-sm font-semibold transition hover:border-orange-500 hover:bg-orange-500/10 disabled:opacity-50 ${
                m === 0 ? "col-span-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : ""
              }`}
            >
              {m === 0 ? "None" : m >= 45 ? "45+" : `${m}`}
              <span className="block text-[10px] font-normal text-muted-foreground">{m === 0 ? "no wait" : "min"}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Shown to everyone nearby for the next 90 minutes.
        </p>
        {status === "error" && <p className="mt-2 text-sm text-destructive">Couldn&rsquo;t save — try again.</p>}
      </div>
    </div>
  );
}
