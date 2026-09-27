/**
 * Subdomain <-> published-app resolution, shared between `proxy.ts` and the
 * `/published-apps/[appSlug]` route tree it rewrites into.
 *
 * Phase 1 only supports the platform's own wildcard subdomain
 * (`{slug}.NEXT_PUBLIC_ROOT_DOMAIN`). Custom domains (`custom_domain` on the
 * `apps` table) are modeled in the schema but not resolved here yet — see
 * the README's phase notes before wiring up Vercel Domains / Cloudflare for
 * SaaS.
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
