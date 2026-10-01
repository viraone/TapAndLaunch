"use client";

import { useEffect, useMemo, useState } from "react";
import { Fuel, LocateFixed, Navigation, Pencil, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import type { FuelGrade, GasDirectoryBlockConfig } from "@/types/database";
import type { NearbyStation } from "@/lib/gas/nearby";

const GRADES: FuelGrade[] = ["regular", "midgrade", "premium", "diesel"];
const GRADE_LABELS: Record<FuelGrade, string> = {
  regular: "Regular",
  midgrade: "Midgrade",
  premium: "Premium",
  diesel: "Diesel",
};

type Position = { latitude: number; longitude: number; label: string; live: boolean };

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Recognisable brand colours for the avatar; anything else gets a stable
 * hue from its name so the same station always looks the same. */
const BRAND_COLORS: Array<[RegExp, string]> = [
  [/shell/i, "from-amber-400 to-yellow-500 text-amber-950"],
  [/\b76\b/, "from-orange-500 to-red-500 text-white"],
  [/chevron/i, "from-sky-500 to-blue-600 text-white"],
  [/arco|ampm/i, "from-blue-500 to-indigo-600 text-white"],
  [/costco/i, "from-red-500 to-rose-600 text-white"],
  [/safeway/i, "from-rose-500 to-red-600 text-white"],
  [/mobil|exxon/i, "from-red-500 to-blue-600 text-white"],
  [/texaco/i, "from-red-600 to-red-700 text-white"],
  [/bp\b/i, "from-lime-400 to-green-600 text-green-950"],
  [/circle k/i, "from-red-500 to-orange-500 text-white"],
  [/fred meyer|kroger|qfc/i, "from-blue-600 to-indigo-700 text-white"],
];
const FALLBACK_COLORS = [
  "from-indigo-400 to-violet-500 text-white",
  "from-pink-400 to-fuchsia-500 text-white",
  "from-teal-400 to-cyan-500 text-teal-950",
  "from-emerald-400 to-green-500 text-emerald-950",
  "from-orange-400 to-amber-500 text-orange-950",
];
function brandStyle(name: string): string {
  for (const [pattern, cls] of BRAND_COLORS) if (pattern.test(name)) return cls;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}
function brandInitials(name: string): string {
  const cleaned = name.replace(/[^a-z0-9 ]/gi, " ").trim();
  if (/^\d+$/.test(cleaned)) return cleaned.slice(0, 2);
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : cleaned.slice(0, 2).toUpperCase();
}

/**
 * GasPal. Asks the browser for the viewer's position once, then ranks the
 * stations our server returns for that spot (Google Places, cached — see
 * lib/gas/nearby.ts) by the selected grade's price or by distance. Falls
 * back to the block's configured point if location is unavailable.
 */
export function GasDirectoryRuntime({ config }: { config: GasDirectoryBlockConfig }) {
  const radius = config.radius_miles ?? 2;
  const [position, setPosition] = useState<Position | null>(null);
  const [locState, setLocState] = useState<"asking" | "live" | "fallback" | "none">("asking");
  const [stations, setStations] = useState<NearbyStation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grade, setGrade] = useState<FuelGrade>(config.default_grade ?? "regular");
  const [sort, setSort] = useState<"price" | "distance">(config.default_sort ?? "price");
  const [editing, setEditing] = useState<NearbyStation | null>(null);
  const [adding, setAdding] = useState(false);

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

  /** Asks the browser for a fix; every setState here runs inside a
   * geolocation callback (or a deferred tick), never synchronously — which
   * is what lets the mount effect below call it without the
   * set-state-in-effect rule firing. */
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

  // Ask for location on mount (effect, not render: browser-only API).
  useEffect(() => {
    requestPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchNearby(pos: Position): Promise<NearbyStation[]> {
    const res = await fetch("/gas/nearby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: pos.latitude, longitude: pos.longitude, radiusMiles: radius }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Couldn't load stations");
    return body.stations as NearbyStation[];
  }

  /** Button-driven reload (Refresh, after a submission): may set state
   * synchronously since it's an event handler, not an effect. */
  async function load(pos: Position) {
    setRefreshing(true);
    setError(null);
    try {
      setStations(await fetchNearby(pos));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load stations");
    } finally {
      setRefreshing(false);
    }
  }

  // Load whenever the position changes; state is only set in promise
  // callbacks. "Loading" for this first fetch is derived below, not stored.
  useEffect(() => {
    if (!position) return;
    let cancelled = false;
    fetchNearby(position)
      .then((list) => { if (!cancelled) { setStations(list); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load stations"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.latitude, position?.longitude]);

  // Waiting for the location answer counts as loading: nothing has been searched yet.
  const loading = refreshing || (locState === "asking" && stations === null) || (position !== null && stations === null && error === null);

  /** Google often lists a station's shop separately at the same address
   * (ARCO + "ampm", 76 + "Red Retail Store"), and the shop never has a
   * price: drop an unpriced listing that shares an address with a priced one. */
  const visible = useMemo(() => {
    if (!stations) return [];
    const street = (a: string | null) => (a ?? "").split(",")[0].trim().toLowerCase();
    const pricedStreets = new Set(stations.filter((s) => Object.keys(s.prices).length > 0 && s.address).map((s) => street(s.address)));
    return stations.filter((s) => Object.keys(s.prices).length > 0 || !s.address || !pricedStreets.has(street(s.address)));
  }, [stations]);

  /** Stations with a price for this grade, ranked; the rest after, nearest first. */
  const { priced, unpriced } = useMemo(() => {
    const withPrice = visible.filter((s) => s.prices[grade] !== undefined);
    const without = visible.filter((s) => s.prices[grade] === undefined).sort((a, b) => a.distanceMiles - b.distanceMiles);
    withPrice.sort((a, b) =>
      sort === "distance"
        ? a.distanceMiles - b.distanceMiles
        : a.prices[grade]!.price - b.prices[grade]!.price || a.distanceMiles - b.distanceMiles
    );
    return { priced: withPrice, unpriced: without };
  }, [visible, sort, grade]);

  const stats = useMemo(() => {
    if (priced.length === 0) return null;
    const cheapest = priced.reduce((min, s) => (s.prices[grade]!.price < min.prices[grade]!.price ? s : min), priced[0]);
    const lowest = cheapest.prices[grade]!.price;
    const average = priced.reduce((sum, s) => sum + s.prices[grade]!.price, 0) / priced.length;
    return { lowest, cheapestStation: cheapest, average, count: priced.length };
  }, [priced, grade]);

  const locationLabel =
    locState === "asking" ? "Locating you…" : locState === "live" ? "Near you" : `Near ${position?.label ?? "…"}`;
  const saving = stats ? stats.average - stats.lowest : 0;

  return (
    <div className="pb-8">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-neutral-950 px-4 pb-5 pt-4 text-neutral-50">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-1/4 -top-1/2 h-[140%] w-[90%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.32),transparent_65%)] blur-2xl" />
          <div className="absolute -right-1/4 -top-1/3 h-[120%] w-[80%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.25),transparent_65%)] blur-2xl" />
        </div>

        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-emerald-950 shadow-lg shadow-emerald-500/30">
              <Fuel className="h-[18px] w-[18px]" strokeWidth={2.5} />
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

          <h2 className="mt-4 text-[26px] font-bold leading-[1.1] tracking-tight">{config.title || "Cheapest gas near me"}</h2>

          {/* Best-price spotlight */}
          <div className="mt-4 min-h-[8.5rem]">
            {stats && !loading ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
                      Cheapest {GRADE_LABELS[grade]} · {radius} mi
                    </p>
                    <p className="mt-1 text-[52px] font-bold leading-none tracking-tight tabular-nums">
                      <span className="mr-0.5 align-top text-2xl text-emerald-300">$</span>
                      {stats.lowest.toFixed(2)}
                    </p>
                    <p className="mt-2 truncate text-sm text-neutral-300">
                      <span className="font-medium text-white">{stats.cheapestStation.brand || stats.cheapestStation.name}</span>
                      <span className="text-neutral-400"> · {stats.cheapestStation.distanceMiles.toFixed(1)} mi</span>
                      {stats.cheapestStation.prices[grade]?.updatedAt && (
                        <span className="text-neutral-500"> · {timeAgo(stats.cheapestStation.prices[grade]!.updatedAt)}</span>
                      )}
                    </p>
                  </div>
                  <a
                    href={directionsUrl(stats.cheapestStation)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 flex-col items-center gap-1 rounded-2xl bg-emerald-400 px-3.5 py-2.5 text-emerald-950 shadow-lg shadow-emerald-500/30 transition active:scale-95"
                  >
                    <Navigation className="h-5 w-5" strokeWidth={2.5} />
                    <span className="text-xs font-bold">Go</span>
                  </a>
                </div>
                {saving >= 0.01 && (
                  <p className="mt-3 flex items-center gap-1.5 border-t border-white/10 pt-3 text-xs text-neutral-300">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    <span>
                      <span className="font-semibold text-emerald-300">${saving.toFixed(2)}/gal</span> under the average · about{" "}
                      <span className="font-semibold text-white">${(saving * 15).toFixed(2)}</span> on a 15-gallon fill
                    </span>
                  </p>
                )}
              </div>
            ) : loading ? (
              <div className="h-[8.5rem] animate-pulse rounded-3xl bg-white/10" />
            ) : (
              <p className="text-sm text-neutral-400">
                {locState === "none" ? "Turn on location to see prices around you." : `No ${GRADE_LABELS[grade].toLowerCase()} prices nearby yet.`}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Sticky controls ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/90 px-4 py-2.5 backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-1 rounded-full bg-muted p-1">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrade(g)}
              aria-pressed={grade === g}
              className={`rounded-full py-1.5 text-xs font-semibold transition ${
                grade === g ? "bg-foreground text-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              {GRADE_LABELS[g]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {stats ? `${stats.count} with prices · avg $${stats.average.toFixed(2)}` : loading ? "Finding stations…" : ""}
          </p>
          <div className="flex shrink-0 rounded-full bg-muted p-0.5 text-xs font-medium">
            {(["price", "distance"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1 transition ${sort === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                {s === "price" ? "Cheapest" : "Nearest"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── States ──────────────────────────────────────────────────── */}
      <div className="px-4">
        {locState === "none" && (
          <div className="mt-4 rounded-2xl border border-dashed p-6 text-center">
            <Navigation className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Location access is needed to find gas near you.</p>
            <button
              type="button"
              onClick={locate}
              className="mt-3 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
            >
              Try again
            </button>
          </div>
        )}
        {error && (
          <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {loading && !stations && (
          <ul className="mt-3 space-y-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="flex animate-pulse items-center gap-3 rounded-2xl border p-3">
                <div className="h-12 w-12 rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
                <div className="h-8 w-16 rounded bg-muted" />
              </li>
            ))}
          </ul>
        )}

        {stations && visible.length === 0 && !loading && (
          <div className="mt-4 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No stations within {radius} miles.
          </div>
        )}

        {/* ── Station list ──────────────────────────────────────────── */}
        <ul className="mt-3 space-y-2">
          {priced.map((s, index) => (
            <StationCard
              key={s.id}
              station={s}
              grade={grade}
              rank={sort === "price" ? index + 1 : null}
              lowest={stats?.lowest ?? null}
              onEdit={() => setEditing(s)}
            />
          ))}
        </ul>

        {unpriced.length > 0 && (
          <>
            <p className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              No {GRADE_LABELS[grade].toLowerCase()} price yet
            </p>
            <ul className="space-y-2">
              {unpriced.map((s) => (
                <StationCard key={s.id} station={s} grade={grade} rank={null} lowest={null} onEdit={() => setEditing(s)} />
              ))}
            </ul>
          </>
        )}

        {/* ── Footer actions ────────────────────────────────────────── */}
        {(stations || error) && (
          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => position && load(position)}
              disabled={loading}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={!position}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add station
            </button>
          </div>
        )}
        {(stations || error) && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">Prices from Google and drivers like you · tap a station for directions</p>
        )}
      </div>

      {editing && (
        <PriceForm
          station={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); if (position) void load(position); }}
        />
      )}
      {adding && position && (
        <AddStationForm
          position={position}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); void load(position); }}
        />
      )}
    </div>
  );
}

function directionsUrl(s: NearbyStation): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`;
}

/** A price older than this is shown in amber: it may have moved since. */
const STALE_MS = 3 * 24 * 60 * 60 * 1000;
function isStale(iso: string | null): boolean {
  return iso !== null && Date.now() - new Date(iso).getTime() > STALE_MS;
}

function StationCard({
  station: s,
  grade,
  rank,
  lowest,
  onEdit,
}: {
  station: NearbyStation;
  grade: FuelGrade;
  rank: number | null;
  lowest: number | null;
  onEdit: () => void;
}) {
  const p = s.prices[grade];
  const isLowest = p !== undefined && lowest !== null && p.price === lowest;
  const delta = p !== undefined && lowest !== null ? p.price - lowest : null;
  const brand = s.brand || s.name;
  const street = s.address ? s.address.split(",")[0] : null;
  const stale = isStale(p?.updatedAt ?? null);
  return (
    <li
      className={`relative rounded-2xl border bg-card transition ${
        isLowest ? "border-emerald-500/50 shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_10px_28px_-14px_rgba(16,185,129,0.6)]" : p ? "shadow-sm" : "opacity-80"
      }`}
    >
      <a href={directionsUrl(s)} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 pr-[6.5rem] active:opacity-80">
        <div className="relative shrink-0">
          <div className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-sm font-bold shadow-inner ${brandStyle(brand)}`}>
            {brandInitials(brand)}
          </div>
          {rank !== null && (
            <span className="absolute -bottom-1 -left-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-card bg-foreground px-1 text-[10px] font-semibold text-background tabular-nums">
              {rank}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-[15px] font-semibold leading-tight">{s.name}</span>
            {isLowest && (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Cheapest
              </span>
            )}
          </p>
          {street && <p className="mt-0.5 truncate text-xs text-muted-foreground">{street}</p>}
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Navigation className="h-3 w-3" /> {s.distanceMiles.toFixed(1)} mi
            {p?.updatedAt && (
              <span className={stale ? "font-medium text-amber-600 dark:text-amber-400" : ""}>· {timeAgo(p.updatedAt)}</span>
            )}
          </p>
        </div>
      </a>
      <div className="absolute inset-y-0 right-3 flex flex-col items-end justify-center gap-1">
        {p ? (
          <>
            <p className={`text-[26px] font-bold leading-none tracking-tight tabular-nums ${isLowest ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
              <span className="align-top text-sm font-semibold">$</span>
              {p.price.toFixed(2)}
            </p>
            <div className="flex items-center gap-1.5">
              {delta !== null && delta >= 0.01 && <span className="text-[11px] text-muted-foreground tabular-nums">+${delta.toFixed(2)}</span>}
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Update prices at ${s.name}`}
                className="grid h-6 w-6 place-items-center rounded-full bg-muted text-muted-foreground transition active:scale-90"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition active:scale-95"
          >
            <Plus className="h-3 w-3" /> Add price
          </button>
        )}
      </div>
    </li>
  );
}

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border-t bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const SUBMIT_CLASS =
  "mt-3 w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100";
const INPUT_CLASS =
  "w-full rounded-xl border bg-muted/40 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-background focus:ring-2 focus:ring-emerald-500/20";

function PriceForm({ station, onClose, onSaved }: { station: NearbyStation; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Partial<Record<FuelGrade, string>>>(() =>
    Object.fromEntries(GRADES.map((g) => [g, station.prices[g] ? station.prices[g]!.price.toFixed(2) : ""]))
  );
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const body: Record<string, unknown> = { stationId: station.id };
    for (const g of GRADES) if (values[g]) body[g] = Number(values[g]);
    const res = await fetch("/gas/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setStatus("error"); return; }
    onSaved();
  }

  return (
    <Sheet title="Update prices" subtitle={station.name} onClose={onClose}>
      <form onSubmit={submit} className="space-y-2">
        {GRADES.map((g) => (
          <label key={g} className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3.5 py-2 text-sm">
            <span className="font-medium">{GRADE_LABELS[g]}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              $
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="20"
                inputMode="decimal"
                placeholder="0.00"
                value={values[g] ?? ""}
                onChange={(e) => setValues({ ...values, [g]: e.target.value })}
                className="w-24 rounded-lg border bg-background px-2.5 py-1.5 text-right text-base font-semibold text-foreground outline-none tabular-nums focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
            </span>
          </label>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">Leave a grade blank to keep its current price.</p>
        {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t save — try again.</p>}
        <button type="submit" disabled={status === "saving"} className={SUBMIT_CLASS}>
          {status === "saving" ? "Saving…" : "Submit prices"}
        </button>
      </form>
    </Sheet>
  );
}

function AddStationForm({ position, onClose, onSaved }: { position: Position; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/gas/stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, brand: brand || undefined, address: address || undefined, latitude: position.latitude, longitude: position.longitude }),
    });
    if (!res.ok) { setStatus("error"); return; }
    onSaved();
  }

  return (
    <Sheet title="Add a station" subtitle="Pinned to where you are right now" onClose={onClose}>
      <form onSubmit={submit} className="space-y-2.5">
        <input required placeholder="Station name (e.g. Shell)" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} />
        <input placeholder="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} className={INPUT_CLASS} />
        <input placeholder="Street address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} className={INPUT_CLASS} />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Fuel className="h-3.5 w-3.5" />
          {position.live ? "Uses your current GPS position." : `Uses ${position.label}.`}
        </p>
        {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t save — try again.</p>}
        <button type="submit" disabled={status === "saving"} className={SUBMIT_CLASS}>
          {status === "saving" ? "Adding…" : "Add station"}
        </button>
      </form>
    </Sheet>
  );
}
