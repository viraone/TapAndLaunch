import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service-role Supabase client. Bypasses RLS entirely — never import this
 * into anything that reaches the browser (the `server-only` import above
 * makes that a build error, not just a convention).
 *
 * Used by:
 *  - the published-PWA runtime (app/published-apps/**), which reads other tenants'
 *    published content on behalf of anonymous visitors who are not Supabase
 *    Auth users at all;
 *  - server routes that write `app_members` / `analytics_events`, which have
 *    no anon/authenticated RLS policy by design (see the migration).
 *
 * Every call site is responsible for its own authorization checks (e.g. "is
 * this app published?") since RLS provides none here.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
