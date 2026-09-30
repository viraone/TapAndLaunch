"use client";

import { useEffect, useMemo, useState } from "react";
import { Fuel, LocateFixed, MapPin, Plus, RefreshCw } from "lucide-react";
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

  const loading = refreshing || (position !== null && stations === null && error === null);

  const ranked = useMemo(() => {
    if (!stations) return [];
    const list = [...stations];
    if (sort === "distance") {
      list.sort((a, b) => a.distanceMiles - b.distanceMiles);
    } else {
      // Priced stations first, cheapest first; unpriced trail, nearest first.
      list.sort((a, b) => {
        const pa = a.prices[grade]?.price;
        const pb = b.prices[grade]?.price;
        if (pa === undefined && pb === undefined) return a.distanceMiles - b.distanceMiles;
        if (pa === undefined) return 1;
        if (pb === undefined) return -1;
        return pa - pb || a.distanceMiles - b.distanceMiles;
      });
    }
    return list;
  }, [stations, sort, grade]);

  const lowest = useMemo(() => {
    const priced = ranked.map((s) => s.prices[grade]?.price).filter((p): p is number => p !== undefined);
    return priced.length ? Math.min(...priced) : null;
  }, [ranked, grade]);

  return (
    <div className="px-4 py-3">
      {config.title && <h2 className="mb-2 text-lg font-semibold">{config.title}</h2>}

      {/* Sticky controls: grade pills + sort toggle */}
      <div className="sticky top-0 z-10 -mx-4 space-y-2 bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex gap-1.5 overflow-x-auto">
          {GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrade(g)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
                grade === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {GRADE_LABELS[g]}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="inline-flex rounded-full border p-0.5">
            {(["price", "distance"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1 transition ${sort === s ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {s === "price" ? "Price ↑" : "Nearest"}
              </button>
            ))}
          </div>
          <button type="button" onClick={locate} className="inline-flex items-center gap-1 text-muted-foreground">
            <LocateFixed className="h-3.5 w-3.5" />
            {locState === "asking" ? "Locating…" : locState === "live" ? "Near you" : `Near ${position?.label ?? "…"}`}
          </button>
        </div>
      </div>

      {locState === "none" && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Location access is needed to find gas near you.{" "}
          <button type="button" onClick={locate} className="underline">Try again</button>
        </p>
      )}
      {error && <p className="py-3 text-sm text-destructive">{error}</p>}
      {loading && !stations && <p className="py-6 text-center text-sm text-muted-foreground">Finding stations…</p>}

      {stations && ranked.length === 0 && !loading && (
        <p className="py-6 text-center text-sm text-muted-foreground">No stations within {radius} miles.</p>
      )}

      <ul className="mt-2 space-y-2">
        {ranked.map((s) => {
          const p = s.prices[grade];
          const isLowest = p !== undefined && lowest !== null && p.price === lowest;
          return (
            <li key={s.id} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.brand && s.brand !== s.name ? `${s.brand} · ${s.name}` : s.name}</p>
                  {s.address && <p className="truncate text-xs text-muted-foreground">{s.address}</p>}
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {s.distanceMiles.toFixed(1)} mi
                    {p?.updatedAt && <span> · Updated {timeAgo(p.updatedAt)}</span>}
                  </p>
                </div>
                <div className="text-right">
                  {p ? (
                    <p className={`text-xl font-bold tabular-nums ${isLowest ? "text-emerald-500" : ""}`}>
                      ${p.price.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No {GRADE_LABELS[grade].toLowerCase()} price</p>
                  )}
                  <button type="button" onClick={() => setEditing(s)} className="mt-1 text-xs underline text-muted-foreground">
                    Update price
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <button type="button" onClick={() => position && load(position)} className="inline-flex items-center gap-1" disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1" disabled={!position}>
          <Plus className="h-3.5 w-3.5" /> Add a station here
        </button>
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

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-background p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

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
    <Sheet title={`Update prices · ${station.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-2">
        {GRADES.map((g) => (
          <label key={g} className="flex items-center justify-between gap-3 text-sm">
            <span>{GRADE_LABELS[g]}</span>
            <input
              type="number"
              step="0.01"
              min="0.5"
              max="20"
              inputMode="decimal"
              placeholder="—"
              value={values[g] ?? ""}
              onChange={(e) => setValues({ ...values, [g]: e.target.value })}
              className="w-28 rounded-md border px-3 py-2 text-right tabular-nums"
            />
          </label>
        ))}
        {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t save — try again.</p>}
        <button type="submit" disabled={status === "saving"} className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
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
    <Sheet title="Add a station at your location" onClose={onClose}>
      <form onSubmit={submit} className="space-y-2">
        <input required placeholder="Station name (e.g. Shell)" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
        <input placeholder="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
        <input placeholder="Street address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
        <p className="text-xs text-muted-foreground"><Fuel className="mr-1 inline h-3 w-3" />Pinned to {position.live ? "your current GPS position" : position.label}.</p>
        {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t save — try again.</p>}
        <button type="submit" disabled={status === "saving"} className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {status === "saving" ? "Adding…" : "Add station"}
        </button>
      </form>
    </Sheet>
  );
}
