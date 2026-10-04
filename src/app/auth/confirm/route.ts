import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/next-path";

const TYPES: EmailOtpType[] = ["recovery", "signup", "email", "invite", "magiclink", "email_change"];

/**
 * Landing page for links in Supabase emails that use `{{ .TokenHash }}` (see `supabase/templates/recovery.html`).
 * Unlike `/auth/callback`, this works on any device: someone can ask for a password reset on a laptop and open the
 * email on their phone. Verifies the one-time token, sets the session cookie, then goes to `next`.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"), "/dashboard");

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // Used, expired or malformed link.
  if (type === "recovery") return NextResponse.redirect(`${origin}/forgot-password?error=link`);
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
