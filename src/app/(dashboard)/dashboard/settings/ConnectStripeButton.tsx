"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { FIELD, LABEL, PRIMARY_BUTTON } from "./SettingsSection";

const COUNTRIES: Array<[string, string]> = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["GB", "United Kingdom"],
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["IE", "Ireland"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
];

/** Asks the server for a one-time Stripe setup link and goes there. `askCountry` is for the very
 * first connection, when Stripe needs to know where the business is based. */
export function ConnectStripeButton({ label, askCountry = false }: { label: string; askCountry?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState("US");

  async function connect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(askCountry ? { country } : {}),
      });
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
    <div className="space-y-3">
      {askCountry && (
        <div className="space-y-1.5">
          <label htmlFor="stripe-country" className={LABEL}>
            Where is your business based?
          </label>
          <select
            id="stripe-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={FIELD}
          >
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500">You can&rsquo;t change this later.</p>
        </div>
      )}
      <button type="button" onClick={connect} disabled={loading} className={PRIMARY_BUTTON}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
