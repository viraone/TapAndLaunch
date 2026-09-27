import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Still uses the anon key + the signed-in user's session
 * cookie, so RLS applies exactly as it would in the browser — this is what
 * the dashboard and builder API routes use.
 *
 * Not for rendering published PWAs: that path has no signed-in Supabase user
 * and must read data other tenants own, so it uses `admin.ts` instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` is called from a Server Component in some render
            // paths (e.g. during a page render triggered by middleware
            // refreshing the session) where cookies are read-only. Safe to
            // ignore as long as session refresh also runs in the proxy.
          }
        },
      },
    }
  );
}
