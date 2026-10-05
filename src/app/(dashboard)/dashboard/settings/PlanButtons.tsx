"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Interval = "month" | "year";

/** Sends the admin to Stripe: to pay for a plan (`interval`), or, with no interval, to manage the one they have. */
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
        <Button onClick={() => go("manage")} disabled={loading !== null}>
          {loading === "manage" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Manage billing
        </Button>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => go("year")} disabled={loading !== null} className="h-auto flex-col items-start gap-0.5 py-3 text-left">
            <span className="flex items-center gap-2 font-semibold">
              {loading === "year" && <Loader2 className="h-4 w-4 animate-spin" />}
              Yearly
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">Best value</span>
            </span>
            <span className="text-xs font-normal opacity-80">{labels?.year}</span>
          </Button>
          <Button onClick={() => go("month")} disabled={loading !== null} variant="outline" className="h-auto flex-col items-start gap-0.5 py-3 text-left">
            <span className="flex items-center gap-2 font-semibold">
              {loading === "month" && <Loader2 className="h-4 w-4 animate-spin" />}
              Monthly
            </span>
            <span className="text-xs font-normal text-muted-foreground">{labels?.month}</span>
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
