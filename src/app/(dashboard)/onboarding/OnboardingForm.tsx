"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_BUTTON } from "@/components/auth/AuthShell";
import { addressFor, slugify } from "@/lib/apps/slug";
import { NETWORK_ERROR, SERVER_ERROR } from "@/lib/friendly-errors";

/** The longest an organization name may be (the server enforces the same limit). */
const NAME_MAX_LENGTH = 120;

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // `disabled={loading}` only takes effect after a re-render, so a fast double-click could send two requests.
  const submitting = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);

    // Whatever goes wrong (offline, a server error page instead of JSON), the button must come back with a sentence a
    // person can read; otherwise it sits on "Creating…" for good.
    const fail = (message: string) => {
      setLoading(false);
      setError(message);
      submitting.current = false;
    };

    let res: Response;
    try {
      res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: addressFor(name) }),
      });
    } catch {
      fail(NETWORK_ERROR);
      return;
    }
    const body: { error?: string } | null = await res.json().catch(() => null);

    if (!res.ok) {
      fail(res.status === 401 ? "Your session has ended. Log in again, then create your organization." : typeof body?.error === "string" && body.error.trim() && res.status < 500 ? body.error : SERVER_ERROR);
      return;
    }

    // The guard stays on from here: this page is about to be replaced.
    router.push("/dashboard");
    router.refresh();
  }

  const address = slugify(name);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          required
          autoFocus
          maxLength={NAME_MAX_LENGTH}
          className="h-11"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Agency"
        />
        {name.trim() && <p className="text-xs text-neutral-500">{address ? `URL: ${address}` : "We'll choose a web address for you."}</p>}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading || !name.trim()} className={AUTH_BUTTON}>
        {loading ? "Creating…" : "Create organization"}
        {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
    </form>
  );
}
