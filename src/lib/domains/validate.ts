import { getRootDomain } from "@/lib/tenant";

const HOSTNAME_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

/**
 * Basic sanity checks before ever calling the Vercel API — not a
 * replacement for it. Rejects the platform's own root domain (a tenant
 * pointing their custom domain at it would mean the platform's own
 * dashboard traffic starts matching the custom-domain lookup in
 * `resolveAppSlugForHost`) and anything that isn't a plausible hostname.
 */
export function validateCustomDomain(domain: string): string | null {
  const normalized = domain.trim().toLowerCase();

  if (!HOSTNAME_PATTERN.test(normalized)) {
    return "Enter a valid domain, like app.yourbrand.com";
  }

  const rootDomain = getRootDomain().split(":")[0]; // strip a dev `:port`
  if (normalized === rootDomain || normalized.endsWith(`.${rootDomain}`)) {
    return `Can't use ${rootDomain} or one of its subdomains as a custom domain`;
  }

  return null;
}
