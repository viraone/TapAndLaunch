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

const lowestRank = <T extends { rank?: number }>(items: T[] | undefined): T | undefined =>
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
