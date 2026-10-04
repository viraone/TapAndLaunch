"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_BUTTON, AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }

    // With email confirmation required (the default for a new Supabase
    // project), `data.session` is null until the user clicks the emailed
    // link, which lands on /auth/callback. With confirmation disabled, a
    // session comes back immediately and we can go straight to onboarding.
    if (data.session) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <AuthShell title="Check your email" subtitle="One more step.">
        <div className="flex items-start gap-3 text-sm text-neutral-300">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <p>
            We sent a confirmation link to <strong className="text-neutral-50">{email}</strong>. Click it
            to finish creating your account.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your first app is a few minutes away."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-neutral-100 underline-offset-4 hover:underline">
            Log in
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
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            required
            minLength={8}
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
        <button
          type="submit"
          disabled={loading}
          className={AUTH_BUTTON}
        >
          {loading ? "Creating account…" : "Create account"}
          {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
        <p className="text-center text-xs text-neutral-500">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-neutral-300">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-neutral-300">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
