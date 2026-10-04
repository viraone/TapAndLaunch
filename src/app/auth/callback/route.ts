import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/next-path";

/**
 * Supabase email-confirmation / magic-link landing page: exchanges the
 * `code` query param for a session cookie, then sends the user on to
 * `next` (a path on this site, e.g. `/reset-password`) or onboarding. A Route Handler (not a Server Component) is
 * required here specifically because it's one of the few places `lib/supabase/server.ts`'s
 * `setAll` can actually persist the new session cookie.
 *
 * The code exchange only works in the browser that asked for the email (it holds the PKCE verifier). Links that must
 * work on any device use `/auth/confirm` instead.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), "/onboarding");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (next === "/reset-password") return NextResponse.redirect(`${origin}/forgot-password?error=link`);
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
