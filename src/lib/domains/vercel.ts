import "server-only";
import type { DomainVerificationRecord } from "@/types/database";

/**
 * Thin wrapper around Vercel's Domains API (the "Vercel Domains API"
 * option from the Phase 6 decision — Cloudflare for SaaS was the
 * alternative, not used here). Implemented against Vercel's documented
 * REST API shape; not exercised against a real Vercel account in this
 * repo (no credentials to test with — same honesty as the Resend/Twilio
 * wrappers, just a more involved multi-step flow here). Double-check
 * response shapes against Vercel's current API reference before relying on
 * this in production.
 *
 * Flow: `addDomain` (returns DNS records to configure if not immediately
 * verified) → tenant adds those records at their registrar → `verifyDomain`
 * (re-checks and returns `verified: true` once DNS propagates). SSL is
 * provisioned automatically by Vercel once verified; nothing here
 * requests it separately.
 */

export interface VercelDomainResult {
  verified: boolean;
  verification: DomainVerificationRecord[];
  error?: string;
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

export async function addDomain(domain: string): Promise<VercelDomainResult> {
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

  return { verified: !!body.verified, verification: body.verification ?? [] };
}

/** Re-checks a domain already added to the project — call this from a
 * "Check verification" button once the tenant says they've added the DNS
 * records. */
export async function verifyDomain(domain: string): Promise<VercelDomainResult> {
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

  return { verified: !!body.verified, verification: body.verification ?? [] };
}

export async function removeDomain(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) {
    return { ok: false, error: "Custom domains are not configured on this server" };
  }

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
