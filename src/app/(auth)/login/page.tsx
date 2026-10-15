"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AUTH_BUTTON, AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/friendly-errors";

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
  // See the sign-up page: the ref stops a fast double-click sending two requests before the button is disabled.
  const submitting = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(friendlyError(error));
        submitting.current = false;
        return;
      }

      try {
        if (remember) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      } catch {
        // Private mode / blocked storage: logging in still works, we just
        // won't prefill next time.
      }

      // The guard stays on from here: this page is about to be replaced.
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(friendlyError(err as Error));
      submitting.current = false;
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to keep building."
      footer={
        <>
          No account?{" "}
          <Link href="/signup" className="font-medium text-neutral-950 underline-offset-4 hover:underline">
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
            className="h-11"
            value={email}
            onChange={(e) => setTypedEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-neutral-500 underline-offset-4 hover:text-neutral-950 hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
          <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
          Remember me on this device
        </label>
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className={AUTH_BUTTON}
        >
          {loading ? "Logging in…" : "Log in"}
          {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>
    </AuthShell>
  );
}
