import { normalizeSite, resolveAndCheck, type Lookup } from "seositetuneup";

const MAX_LENGTH = 200;

export type SiteValidation =
  | { ok: true; site: string; host: string }
  | { ok: false; message: string };

/**
 * Turn whatever a visitor typed into the site to check, or a friendly reason not to. The optional `lookup` is for tests, so they
 * never touch real DNS. On success `site` is the normalised address (always http:// or https://) and `host` is its host, lower-case
 * and without "www.", for the per-host cooldown.
 */
export async function validateSite(input: string, lookup?: Lookup): Promise<SiteValidation> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, message: "Enter a website address to check." };
  if (trimmed.length > MAX_LENGTH) return { ok: false, message: "That address is too long to check." };

  // A scheme other than http(s) is never a site we can fetch.
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") {
    return { ok: false, message: "I can only check http:// and https:// addresses." };
  }

  let site: string;
  try {
    site = normalizeSite(trimmed);
  } catch {
    return { ok: false, message: "That does not look like a website address." };
  }
  const url = new URL(site);

  if (url.username || url.password) return { ok: false, message: "I can only check a plain address — no username or password." };
  if (url.port) return { ok: false, message: "I can only check the usual web ports, not a custom one." };

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!host) return { ok: false, message: "That does not look like a website address." };

  // Never check our own site or its subdomains.
  if (host === "tapandlaunch.com" || host.endsWith(".tapandlaunch.com")) {
    return { ok: false, message: "That's us — check a site outside tapandlaunch.com instead." };
  }

  // Refuse local and private addresses (SSRF guard).
  try {
    const reason = await resolveAndCheck(host, lookup);
    if (reason) return { ok: false, message: "I can only check sites on the public internet — not local or private addresses." };
  } catch {
    // The name does not resolve. That is not a validation refusal: the audit itself will report the site as unreachable.
  }

  return { ok: true, site, host };
}
