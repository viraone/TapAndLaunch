import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every request. Required
 * because Server Components (used throughout `app/(dashboard)`) can read
 * cookies but not write them — see the catch in `lib/supabase/server.ts` —
 * so without this, an access token nearing expiry is never refreshed and
 * users get silently signed out mid-session.
 *
 * Called from `proxy.ts` before its host-based rewrite logic runs.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // The call itself (not its return value) is what triggers a refresh when
  // the current access token is stale.
  await supabase.auth.getUser();

  return response;
}
