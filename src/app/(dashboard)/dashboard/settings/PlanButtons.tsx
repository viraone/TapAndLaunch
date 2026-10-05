"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PRIMARY_BUTTON } from "./SettingsSection";

type Interval = "month" | "year";

/** Sends the admin to Stripe: to pay for a plan (two big choices), or, in `manage` mode, to manage the one they have. */
export function PlanButtons({ mode, labels }: { mode: "choose" | "manage"; labels?: { year: string; month: string } }) {
  const [loading, setLoading] = useState<Interval | "manage" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(which: Interval | "manage") {
    setLoading(which);
    setError(null);
    try {
      const res = await fetch(which === "manage" ? "/api/billing/portal" : "/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(which === "manage" ? {} : { interval: which }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Something went wrong. Try again.");
        setLoading(null);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {mode === "manage" ? (
        <button type="button" onClick={() => go("manage")} disabled={loading !== null} className={PRIMARY_BUTTON}>
          {loading === "manage" && <Loader2 className="h-4 w-4 animate-spin" />}
          Manage billing
        </button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => go("year")}
            disabled={loading !== null}
            className="relative min-h-20 rounded-2xl bg-neutral-950 p-4 text-left text-white shadow-lg shadow-neutral-950/20 transition hover:bg-neutral-800 disabled:opacity-60"
          >
            <span className="flex items-center gap-2 text-base font-semibold">
              {loading === "year" && <Loader2 className="h-4 w-4 animate-spin" />}
              Yearly
              <span className="rounded-full bg-gradient-to-r from-indigo-400 to-pink-400 px-2 py-0.5 text-[11px] font-semibold text-neutral-950">Best value</span>
            </span>
            <span className="mt-1 block text-sm text-white/70">{labels?.year}</span>
          </button>
          <button
            type="button"
            onClick={() => go("month")}
            disabled={loading !== null}
            className="min-h-20 rounded-2xl bg-white p-4 text-left ring-1 ring-neutral-200 transition hover:ring-neutral-950 disabled:opacity-60"
          >
            <span className="flex items-center gap-2 text-base font-semibold text-neutral-950">
              {loading === "month" && <Loader2 className="h-4 w-4 animate-spin" />}
              Monthly
            </span>
            <span className="mt-1 block text-sm text-neutral-500">{labels?.month}</span>
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
