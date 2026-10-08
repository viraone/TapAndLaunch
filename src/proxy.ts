import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { extractAppSlug, getRootDomain, hostRoot, resolveAppSlugForHost } from "@/lib/tenant";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Two responsibilities, in order:
 *  1. Refresh the Supabase session cookie (`lib/supabase/middleware.ts`) —
 *     irrelevant on tenant subdomains today (no dashboard auth there) but
 *     harmless, and keeps this correct if that ever changes.
 *  2. Host-based routing: requests to `{slug}.NEXT_PUBLIC_ROOT_DOMAIN`, or
 *     to a verified custom domain (Phase 6 — `resolveAppSlugForHost`), are
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
  const host = request.headers.get("host");
  // The AI-apps domain only ever serves apps: its bare address (and anything that isn't one app) goes to the main site,
  // so the website, sign-in and dashboard live on one domain only.
  if (hostRoot(host) === "code" && !extractAppSlug(host)) {
    const main = getRootDomain();
    const local = /(^|\.)localhost(:\d+)?$/.test(main);
    // A plain Response: NextResponse.redirect rewrites a `localhost` target to the incoming host.
    const target = `${local ? "http" : "https"}://${main}${request.nextUrl.pathname}${request.nextUrl.search}`;
    return new Response(null, { status: 308, headers: { Location: target } });
  }

  const sessionResponse = await updateSession(request);

  // A DB hiccup on the custom-domain lookup degrades to "no tenant" (falls
  // through to the marketing/dashboard routes) rather than a 500 — every
  // ordinary `{slug}.$ROOT_DOMAIN` request never reaches this catch at all
  // (`resolveAppSlugForHost` returns from the DB-free fast path first).
  let appSlug: string | null;
  try {
    appSlug = await resolveAppSlugForHost(host);
  } catch (error) {
    console.error("Custom domain lookup failed:", error);
    appSlug = null;
  }
  if (!appSlug) return sessionResponse;

  const url = request.nextUrl.clone();
  url.pathname = `/published-apps/${appSlug}${request.nextUrl.pathname}`;

  // The builder's "Try it" mode opens a draft at its real address with a signed preview key (lib/pwa/preview.ts):
  // first on the address, then from a cookie so the app's own requests (places, bookings…) carry it too. The key
  // travels on to the app's routes as one request header; `getPublishedApp` is what checks it.
  const fromQuery = request.nextUrl.searchParams.get("tl_preview");
  const previewKey = fromQuery ?? request.cookies.get("tl_preview")?.value ?? null;
  const requestHeaders = new Headers(request.headers);
  if (previewKey) requestHeaders.set("x-tl-preview", previewKey);
  else requestHeaders.delete("x-tl-preview");

  const rewritten = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  for (const cookie of sessionResponse.cookies.getAll()) {
    rewritten.cookies.set(cookie);
  }
  if (fromQuery) {
    // The app sits in an iframe on the dashboard. SameSite=None + Secure is what a browser needs to keep a cookie
    // set inside an embedded frame; Chrome allows Secure cookies on plain-http localhost, so this works there too.
    rewritten.cookies.set("tl_preview", fromQuery, {
      path: "/",
      maxAge: 60 * 60,
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
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
