import "server-only";
import type { DomainVerificationRecord } from "@/types/database";
import { companionDomain, companionRecord, routingRecord, type VercelDomainConfig } from "./dns";

/**
 * Thin wrapper around Vercel's Domains API (the "Vercel Domains API"
 * option from the Phase 6 decision — Cloudflare for SaaS was the
 * alternative, not used here). Implemented against Vercel's documented
 * REST API shape; not exercised against a real Vercel account in this
 * repo until 2026-10-05 (no credentials to test with — same honesty as the Resend/Twilio
 * wrappers, just a more involved multi-step flow here). Double-check
 * response shapes against Vercel's current API reference before relying on
 * this in production.
 *
 * Flow: `addDomain` (returns DNS records to configure if not immediately
 * verified) → tenant adds those records at their registrar → `verifyDomain`
 * (re-checks and returns `verified: true` once DNS propagates). SSL is
 * provisioned automatically by Vercel once verified; nothing here
 * requests it separately.
 *
 * www (2026-10-18): a root domain and its `www.` twin are both added to the project, the twin as a 308 redirect to
 * the one the customer typed (`ensureRedirect`), so a site never answers on one spelling and not the other. The twin
 * never blocks "Connected": its record is listed among those still to add until its DNS points here.
 */

export interface VercelDomainResult {
  verified: boolean;
  verification: DomainVerificationRecord[];
  error?: string;
  /** Set when the connected domain is fine but its www/root twin could not be added as a redirect. */
  companionError?: string;
}

/** Whether to add/remove the www or root twin along with the domain. Off when another app owns that twin. */
export interface CompanionOptions {
  companion?: boolean;
}

function isConfigured(): boolean {
  return !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

export function isVercelDomainsConfigured(): boolean {
  return isConfigured();
}

function apiUrl(path: string): string {
  const url = new URL(`https://api.vercel.com${path}`);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  return url.toString();
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/** Whether the domain's DNS points at Vercel yet (separate from owning it: "verified" alone does not mean reachable). */
async function getConfig(domain: string): Promise<VercelDomainConfig | null> {
  try {
    const res = await fetch(apiUrl(`/v6/domains/${encodeURIComponent(domain)}/config`), { headers: authHeaders() });
    if (!res.ok) return null;
    return (await res.json()) as VercelDomainConfig;
  } catch {
    return null;
  }
}

/**
 * Combines "does the project own this domain" with "does its DNS point here". An app is only called
 * verified once both are true; until then the records to add include the one that routes traffic to us.
 */
async function finish(
  domain: string,
  body: { verified?: boolean; verification?: DomainVerificationRecord[] },
  options: CompanionOptions = {}
): Promise<VercelDomainResult> {
  const companion = options.companion === false ? null : companionDomain(domain);
  const [config, companionConfig] = await Promise.all([getConfig(domain), companion ? getConfig(companion) : null]);
  const routed = config ? config.misconfigured === false : false;
  const records = [...(body.verification ?? [])];
  if (!routed) records.push(routingRecord(domain, config));
  // The twin is wanted, not required: its record stays on the list until it points here, but "verified" ignores it.
  if (companion && !(companionConfig && companionConfig.misconfigured === false)) {
    const record = companionRecord(domain, companionConfig ?? config);
    if (record) records.push(record);
  }
  return { verified: !!body.verified && routed, verification: records };
}

const alreadyThere = (status: number, body: { error?: { code?: string; message?: string } } | null) =>
  status === 409 || /already/i.test(body?.error?.code ?? "") || /already/i.test(body?.error?.message ?? "");

/**
 * Adds `name` to the project as a permanent (308) redirect to `target`. A twin that is already on the project is fine:
 * its redirect is then set with a PATCH, so a www added by hand earlier starts redirecting too. Vercel's own
 * `redirect` is used, not proxy.ts, so the hop happens at its edge before any request reaches the app.
 */
export async function ensureRedirect(name: string, target: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) {
    return { ok: false, error: "Custom domains are not configured on this server" };
  }
  const payload = { redirect: target, redirectStatusCode: 308 };
  const res = await fetch(apiUrl(`/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, ...payload }),
  });
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!alreadyThere(res.status, body)) {
    return { ok: false, error: body?.error?.message ?? `Vercel API error (${res.status})` };
  }
  const patch = await fetch(apiUrl(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${encodeURIComponent(name)}`), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (patch.ok) return { ok: true };
  const patchBody = (await patch.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false, error: patchBody?.error?.message ?? `Vercel API error (${patch.status})` };
}

export async function addDomain(domain: string, options: CompanionOptions = {}): Promise<VercelDomainResult> {
  if (!isConfigured()) {
    return { verified: false, verification: [], error: "Custom domains are not configured on this server" };
  }

  const res = await fetch(apiUrl(`/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name: domain }),
  });

  const body = await res.json();
  if (!res.ok) {
    return { verified: false, verification: [], error: body?.error?.message ?? `Vercel API error (${res.status})` };
  }

  // The www/root twin rides along as a redirect. Its failure is reported, not fatal: the domain itself is connected.
  const companion = options.companion === false ? null : companionDomain(domain);
  const redirect = companion ? await ensureRedirect(companion, domain) : { ok: true as const };
  const result = await finish(domain, body, options);
  return redirect.ok ? result : { ...result, companionError: redirect.error };
}

/** Re-checks a domain already added to the project — call this from a
 * "Check verification" button once the tenant says they've added the DNS
 * records. */
export async function verifyDomain(domain: string, options: CompanionOptions = {}): Promise<VercelDomainResult> {
  if (!isConfigured()) {
    return { verified: false, verification: [], error: "Custom domains are not configured on this server" };
  }

  const res = await fetch(
    apiUrl(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}/verify`),
    { method: "POST", headers: authHeaders() }
  );

  const body = await res.json();
  if (!res.ok) {
    return { verified: false, verification: [], error: body?.error?.message ?? `Vercel API error (${res.status})` };
  }

  return finish(domain, body, options);
}

async function deleteFromProject(domain: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(
    apiUrl(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${encodeURIComponent(domain)}`),
    { method: "DELETE", headers: authHeaders() }
  );

  // Vercel returns 404 if the domain was already removed on their side —
  // treat that as success rather than an error, since the end state (not
  // attached to the project) is what the caller wants either way.
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.error?.message ?? `Vercel API error (${res.status})` };
  }

  return { ok: true };
}

/** Takes the domain off the project, and its www/root twin with it (unless `companion: false`, when another app owns the twin). */
export async function removeDomain(domain: string, options: CompanionOptions = {}): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) {
    return { ok: false, error: "Custom domains are not configured on this server" };
  }

  const main = await deleteFromProject(domain);
  if (!main.ok) return main;
  const companion = options.companion === false ? null : companionDomain(domain);
  return companion ? deleteFromProject(companion) : main;
}
