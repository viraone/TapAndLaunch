"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_BUTTON, AuthShell } from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/client";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    // Rate limits are worth saying; anything else (including "no such user") gets the same answer as success, so
    // this page can't be used to find out who has an account.
    if (error && /rate limit|seconds/i.test(error.message)) {
      setError("Please wait a minute before asking for another link.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="One more step.">
        <div className="flex items-start gap-3 text-sm text-neutral-300">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <p>
            If <strong className="text-neutral-50">{email}</strong> has a TapAndLaunch account, we sent it a link to choose a
            new password. The link works once and expires in an hour. Check your spam folder if you don&rsquo;t see it.
          </p>
        </div>
        <p className="mt-6 text-sm text-neutral-400">
          <Link href="/login" className="font-medium text-neutral-100 underline-offset-4 hover:underline">
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
          <Link href="/login" className="font-medium text-neutral-100 underline-offset-4 hover:underline">
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
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
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
