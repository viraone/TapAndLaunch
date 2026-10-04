"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { AUTH_BUTTON, AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { createClient } from "@/lib/supabase/client";

/**
 * Choose a new password. Reached from the reset email: `/auth/confirm` (or `/auth/callback`) has already signed the
 * person in with a short-lived recovery session. Lives outside the `(auth)` group on purpose: that layout sends
 * signed-in users to the dashboard, and here they are signed in.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [status, setStatus] = useState<"checking" | "ready" | "no-session">("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setStatus(data.user ? "ready" : "no-session");
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(
        /different from the old/i.test(error.message)
          ? "Choose a password you haven't used for this account."
          : /at least/i.test(error.message)
            ? "Use at least 8 characters."
            : error.message
      );
      return;
    }
    router.push("/dashboard?password=updated");
    router.refresh();
  }

  if (status === "checking") {
    return (
      <AuthShell title="Choose a new password">
        <div className="flex justify-center py-6" role="status" aria-label="Loading">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      </AuthShell>
    );
  }

  if (status === "no-session") {
    return (
      <AuthShell title="This link has expired" subtitle="Reset links work once and expire after an hour.">
        <Link href="/forgot-password" className={AUTH_BUTTON}>
          Get a new link <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="You'll use it the next time you log in.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-neutral-500">At least 8 characters.</p>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={saving} className={AUTH_BUTTON}>
          {saving ? "Saving…" : "Save new password"}
          {!saving && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>
    </AuthShell>
  );
}
