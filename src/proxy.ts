import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractAppSlug } from "@/lib/tenant";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Two responsibilities, in order:
 *  1. Refresh the Supabase session cookie (`lib/supabase/middleware.ts`) —
 *     irrelevant on tenant subdomains today (no dashboard auth there) but
 *     harmless, and keeps this correct if that ever changes.
 *  2. Host-based routing: requests to `{slug}.NEXT_PUBLIC_ROOT_DOMAIN` are
 *     rewritten to the published-PWA route tree at `/published-apps/{slug}/...`;
 *     requests to the root domain itself fall through to the dashboard /
 *     marketing routes.
 *
 * This is the file Next.js 16 calls "Proxy" (the renamed `middleware.ts`
 * convention — see node_modules/next/dist/docs/.../proxy.md). Route-level
 * authorization (who can see which org's data) is never delegated to this
 * file — it stays in RLS and each route's own checks — so a matcher change
 * here can't silently remove an auth check the way it could if this were
 * doing the authorization itself.
 */
export async function proxy(request: NextRequest) {
  const sessionResponse = await updateSession(request);

  const host = request.headers.get("host");
  const appSlug = extractAppSlug(host);
  if (!appSlug) return sessionResponse;

  const url = request.nextUrl.clone();
  url.pathname = `/published-apps/${appSlug}${request.nextUrl.pathname}`;
  const rewritten = NextResponse.rewrite(url);
  for (const cookie of sessionResponse.cookies.getAll()) {
    rewritten.cookies.set(cookie);
  }
  return rewritten;
}

export const config = {
  matcher: [
    /*
     * Run on every request except static assets and Next.js internals —
     * those never depend on which tenant subdomain served them.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
