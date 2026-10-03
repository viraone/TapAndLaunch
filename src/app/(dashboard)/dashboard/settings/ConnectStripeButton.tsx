"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Asks the server for a one-time Stripe setup link and goes there. */
export function ConnectStripeButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setError(body.error ?? "Something went wrong. Try again.");
        setLoading(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={connect} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
