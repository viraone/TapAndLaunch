import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase email-confirmation / magic-link landing page: exchanges the
 * `code` query param for a session cookie, then sends the user on to
 * onboarding. A Route Handler (not a Server Component) is required here
 * specifically because it's one of the few places `lib/supabase/server.ts`'s
 * `setAll` can actually persist the new session cookie.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
