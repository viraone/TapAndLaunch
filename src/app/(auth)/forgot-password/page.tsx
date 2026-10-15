"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_BUTTON, AuthShell } from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/client";
import { isNetworkFailure, isServerFailure, friendlyError } from "@/lib/friendly-errors";

/** Shown when a reset link was already used or has expired (`?error=link`). */
function ExpiredLinkNotice() {
  const params = useSearchParams();
  if (params.get("error") !== "link") return null;
  return (
    <p role="alert" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      That reset link has expired or was already used. Enter your email to get a new one.
    </p>
  );
}

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // See the sign-up page: the ref stops a fast double-click sending two reset emails.
  const submitting = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      // Rate limits are worth saying. So is a request that never got through (offline, or the server failing): saying
      // "we sent it" then would be untrue. Anything else (including "no such user") gets the same answer as success,
      // so this page can't be used to find out who has an account.
      if (error && /rate limit|seconds/i.test(error.message)) {
        setError("Please wait a minute before asking for another link.");
        submitting.current = false;
        return;
      }
      if (error && (isNetworkFailure(error) || isServerFailure(error))) {
        setError(friendlyError(error));
        submitting.current = false;
        return;
      }
      setSent(true);
    } catch (err) {
      setError(friendlyError(err as Error));
      submitting.current = false;
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="One more step.">
        <div className="flex items-start gap-3 text-sm text-neutral-700">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p>
            If <strong className="text-neutral-950">{email}</strong> has a TapAndLaunch account, we sent it a link to choose a
            new password. The link works once and expires in an hour. Check your spam folder if you don&rsquo;t see it.
          </p>
        </div>
        <p className="mt-6 text-sm text-neutral-500">
          <Link href="/login" className="font-medium text-neutral-950 underline-offset-4 hover:underline">
            Back to log in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-neutral-950 underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <ExpiredLinkNotice />
      </Suspense>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="you@example.com"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={loading} className={AUTH_BUTTON}>
          {loading ? "Sending…" : "Send reset link"}
          {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>
    </AuthShell>
  );
}
