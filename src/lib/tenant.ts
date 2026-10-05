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
 * The root domain AI-written apps are published under, e.g. `tapandlaunch.app`, kept apart from TapAndLaunch's own
 * domain: code a customer's AI wrote then can't pass itself off as TapAndLaunch, and if one is ever flagged as harmful
 * the main site isn't. Null until it's set up (then they stay on the main domain, as before).
 */
export function getCodeAppsDomain(): string | null {
  const domain = process.env.NEXT_PUBLIC_CODE_APPS_DOMAIN?.trim().toLowerCase();
  return domain ? domain : null;
}

/** The root domain an app of this kind is published under. */
export function rootDomainFor(kind: "blocks" | "code" | undefined | null): string {
  return kind === "code" ? getCodeAppsDomain() ?? getRootDomain() : getRootDomain();
}

/** Which of TapAndLaunch's root domains a host is under: the main one, the AI-apps one, or neither (a custom domain). */
export function hostRoot(host: string | null): "main" | "code" | null {
  if (!host) return null;
  const h = host.toLowerCase();
  const code = getCodeAppsDomain();
  if (code && (h === code || h.endsWith(`.${code}`))) return "code";
  const main = getRootDomain().toLowerCase();
  if (h === main || h.endsWith(`.${main}`)) return "main";
  return null;
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

  const normalizedHost = host.toLowerCase();
  // The AI-apps domain first: locally it can sit under the main one (`apps.localhost:3100`).
  const code = getCodeAppsDomain();
  if (code) {
    const slug = slugUnder(normalizedHost, code);
    if (slug !== undefined) return slug;
  }
  return slugUnder(normalizedHost, getRootDomain().toLowerCase()) ?? null;
}

/** The app slug in `{slug}.{root}`; null for the root itself; undefined when the host isn't under this root at all. */
function slugUnder(normalizedHost: string, normalizedRoot: string): string | null | undefined {
  if (normalizedHost === normalizedRoot || normalizedHost === `www.${normalizedRoot}`) return null;
  if (!normalizedHost.endsWith(`.${normalizedRoot}`)) return undefined;
  const subdomain = normalizedHost.slice(0, -(`.${normalizedRoot}`.length));
  // Guard against nested/multi-level subdomains (`a.b.{root}`) — apps only ever get one segment.
  if (!subdomain || subdomain.includes(".")) return undefined;
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

  // TapAndLaunch's own domains (and anything under them) are never customer domains.
  if (hostRoot(host)) return null;
  const normalizedHost = host.toLowerCase();

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
