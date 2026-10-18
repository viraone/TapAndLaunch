import type { DomainVerificationRecord } from "@/types/database";

/** What Vercel's `GET /v6/domains/{domain}/config` tells us about whether a domain's DNS points at Vercel. */
export interface VercelDomainConfig {
  misconfigured?: boolean;
  recommendedCNAME?: Array<{ rank?: number; value?: string }>;
  recommendedIPv4?: Array<{ rank?: number; value?: string[] | string }>;
}

/** Vercel's long-standing defaults, used when its answer has no recommendation. */
const DEFAULT_CNAME = "cname.vercel-dns.com";
const DEFAULT_IPV4 = "76.76.21.21";

/** Second-level suffixes where the registered domain has three labels (`brand.co.uk` is a root domain too). */
const TWO_PART_SUFFIXES = new Set(["co.uk", "org.uk", "com.au", "net.au", "co.nz", "co.jp", "com.br", "co.za", "com.mx", "co.in"]);

/** True for a root domain (`brand.com`), which can't carry a CNAME and needs an A record instead. */
export function isApexDomain(domain: string): boolean {
  const labels = domain.toLowerCase().split(".");
  if (labels.length === 2) return true;
  return labels.length === 3 && TWO_PART_SUFFIXES.has(labels.slice(1).join("."));
}

/** The domain that was bought at a registrar (`brand.com` for `shop.app.brand.com`, `brand.co.uk` for `www.brand.co.uk`). */
export function registeredDomain(host: string): string {
  const labels = host.trim().toLowerCase().replace(/\.$/, "").split(".");
  const take = labels.length >= 3 && TWO_PART_SUFFIXES.has(labels.slice(-2).join(".")) ? 3 : 2;
  return labels.slice(-take).join(".");
}

const lowestRank =<T extends { rank?: number }>(items: T[] | undefined): T | undefined =>
  items && items.length ? [...items].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0] : undefined;

/** The one DNS record that points the domain at Vercel: an A record for a root domain, otherwise a CNAME. */
export function routingRecord(domain: string, config: VercelDomainConfig | null): DomainVerificationRecord {
  if (isApexDomain(domain)) {
    const ip = lowestRank(config?.recommendedIPv4)?.value;
    return { type: "A", domain: "@", value: (Array.isArray(ip) ? ip[0] : ip) || DEFAULT_IPV4, reason: "Points your domain at TapAndLaunch" };
  }
  const label = domain.split(".")[0];
  const cname = lowestRank(config?.recommendedCNAME)?.value;
  return { type: "CNAME", domain: label, value: (cname || DEFAULT_CNAME).replace(/\.$/, ""), reason: "Points your domain at TapAndLaunch" };
}

/**
 * The other spelling of a domain that visitors type too: `www.brand.com` for `brand.com`, and `brand.com` for
 * `www.brand.com`. Null for any other subdomain (`app.brand.com` has no twin). Both spellings are added to Vercel, the
 * companion as a 308 redirect to the one the customer connected, so "www and non-www agree" always holds.
 */
export function companionDomain(domain: string): string | null {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  if (isApexDomain(d)) return `www.${d}`;
  if (d.startsWith("www.") && isApexDomain(d.slice(4))) return d.slice(4);
  return null;
}

/** The DNS record that makes the companion spelling reach Vercel, so its redirect can answer. */
export function companionRecord(domain: string, config: VercelDomainConfig | null): DomainVerificationRecord | null {
  const companion = companionDomain(domain);
  if (!companion) return null;
  return { ...routingRecord(companion, config), reason: `Sends ${companion} to ${domain.trim().toLowerCase()}` };
}
