"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { createClient } from "@/lib/supabase/client";

/** localStorage key for the "Remember me" email. Only the email is stored —
 * the password stays with the browser's own password manager (the inputs
 * carry the `autoComplete` hints it needs), and the session itself lives in
 * the Supabase cookie, which already outlives a browser restart. */
const REMEMBERED_EMAIL_KEY = "tapandlaunch.login-email";

function readRememberedEmail(): string {
  try {
    return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

// The stored email never changes while this page is mounted, so there is
// nothing to subscribe to; `useSyncExternalStore` is used purely so the
// server render ("") and the first client render agree, then the remembered
// value appears without a setState-in-effect.
const noopSubscribe = () => () => {};

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const rememberedEmail = useSyncExternalStore(noopSubscribe, readRememberedEmail, () => "");
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? rememberedEmail;
  const [remember, setRemember] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    try {
      if (remember) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    } catch {
      // Private mode / blocked storage: logging in still works, we just
      // won't prefill next time.
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to keep building."
      footer={
        <>
          No account?{" "}
          <Link href="/signup" className="font-medium text-neutral-100 underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="h-10"
            value={email}
            onChange={(e) => setTypedEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
          <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
          Remember me on this device
        </label>
        {error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="group mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
        >
          {loading ? "Logging in…" : "Log in"}
          {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>
    </AuthShell>
  );
}
