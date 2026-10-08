import { createHmac, timingSafeEqual } from "node:crypto";

// Not marked "server-only" so its tests can import it; the secret below is read from the server's environment, which
// is never shipped to the browser, and nothing client-side imports this file.

/**
 * The builder's "Try it" mode shows an app at its real address, inside the phone frame, before it is published. A
 * draft is never served to the public, so the builder asks for a preview key: a signed, short-lived token tied to
 * one app. The owner's browser carries it (first as `?tl_preview=` on the address, then as a cookie the proxy sets),
 * and `getPublishedApp` serves the draft only when the token checks out. Nobody can mint one without the server's
 * secret, and an old one stops working after an hour.
 */
const LIFETIME_SECONDS = 60 * 60;

function secret(): string {
  // A dedicated secret when one is set; otherwise the service-role key, which only the server ever holds.
  const s = process.env.PREVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("No secret to sign preview keys with");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** A preview key for `slug`, good for an hour. */
export function signPreviewToken(slug: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + LIFETIME_SECONDS;
  const payload = `${slug}:${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/** True when `token` is a preview key for `slug` that has not run out. */
export function verifyPreviewToken(token: string | null | undefined, slug: string, now = Date.now()): boolean {
  if (!token) return false;
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  let payload: string;
  try {
    payload = Buffer.from(body, "base64url").toString();
  } catch {
    return false;
  }
  const [tokenSlug, expText] = payload.split(":");
  if (tokenSlug !== slug) return false;
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The header the proxy sets from the address or the cookie, so every route under the app reads one place. */
export const PREVIEW_HEADER = "x-tl-preview";
export const PREVIEW_COOKIE = "tl_preview";
export const PREVIEW_QUERY = "tl_preview";
