/**
 * Subdomain <-> published-app resolution, shared between `proxy.ts` and the
 * `/published-apps/[appSlug]` route tree it rewrites into. Custom domains
 * (Phase 6) are resolved separately below, in `resolveAppSlugForHost` —
 * `extractAppSlug` itself stays a pure, DB-free function since it's the
 * fast path that runs on every request.
 */
export function getRootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
}

/**
 * Returns the published-app slug for a request `Host` header, or `null` if
 * the request is for the root domain itself (the marketing site / dashboard)
 * rather than a tenant subdomain.
 */
export function extractAppSlug(host: string | null): string | null {
  if (!host) return null;

  // Local development only (`npm run dev:phone`): open one app from a phone by the Mac's
  // plain IP address, because some routers refuse to resolve names that point to a
  // private address. Never active in a production build.
  const devSlug = process.env.NODE_ENV !== "production" ? process.env.DEV_APP_SLUG : undefined;
  if (devSlug && /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host)) return devSlug;

  const rootDomain = getRootDomain();
  const normalizedHost = host.toLowerCase();
  const normalizedRoot = rootDomain.toLowerCase();

  if (normalizedHost === normalizedRoot || normalizedHost === `www.${normalizedRoot}`) {
    return null;
  }

  if (!normalizedHost.endsWith(`.${normalizedRoot}`)) {
    // Not a subdomain of our root domain — likely a custom domain (deferred)
    // or an unrelated request (health check, etc). Treat as "no tenant".
    return null;
  }

  const subdomain = normalizedHost.slice(0, -(`.${normalizedRoot}`.length));

  // Guard against nested/multi-level subdomains (`a.b.{root}`) — apps only
  // ever get one segment.
  if (!subdomain || subdomain.includes(".")) return null;

  return subdomain;
}

/**
 * The full host → app-slug resolution `proxy.ts` actually uses: the fast,
 * DB-free subdomain check first, falling back to a `custom_domain` lookup
 * (Phase 6) only for hosts that don't match the platform's own wildcard
 * subdomain — so ordinary `{slug}.$ROOT_DOMAIN` traffic never pays for a
 * query it doesn't need.
 *
 * Only a `custom_domain_status = 'verified'` **and** `status = 'published'`
 * row resolves — an app mid-verification, or unpublished, must not become
 * reachable just because someone pointed DNS at it early.
 */
export async function resolveAppSlugForHost(host: string | null): Promise<string | null> {
  const subdomainSlug = extractAppSlug(host);
  if (subdomainSlug) return subdomainSlug;
  if (!host) return null;

  const rootDomain = getRootDomain().toLowerCase();
  const normalizedHost = host.toLowerCase();
  if (normalizedHost === rootDomain || normalizedHost === `www.${rootDomain}`) {
    return null;
  }

  // Deferred import: this file is otherwise DB-free and importable from
  // anywhere; the admin client is only needed for this one custom-domain
  // path.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data } = await admin
    .from("apps")
    .select("slug")
    .eq("custom_domain", normalizedHost)
    .eq("custom_domain_status", "verified")
    .eq("status", "published")
    .maybeSingle();

  return data?.slug ?? null;
}
