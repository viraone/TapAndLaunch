import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * Google's OAuth endpoints and the small pure helpers around them.
 *
 * Nothing here reads the database. The route handlers in
 * `src/app/api/integrations/google/**` use these, together with
 * `connection.ts`, to connect one Gmail account per app.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/contacts.readonly",
] as const;

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const CONTACTS_READONLY_SCOPE = "https://www.googleapis.com/auth/contacts.readonly";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

/** A state older than this is refused, so a copied start link cannot be replayed later. */
const STATE_LIFETIME_SECONDS = 600;
const FETCH_TIMEOUT_MS = 10_000;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  keyBase64: string;
}

/** True when the three required values are set and the encryption key is the right size. */
export function isGoogleConfigured(): boolean {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const keyBase64 = process.env.GOOGLE_TOKEN_ENC_KEY;
  if (!clientId || !clientSecret || !keyBase64) return false;
  return Buffer.from(keyBase64, "base64").length === 32;
}

export function googleConfig(): GoogleConfig | null {
  if (!isGoogleConfigured()) return null;
  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    keyBase64: process.env.GOOGLE_TOKEN_ENC_KEY!,
  };
}

/** The address Google sends the browser back to. Set in the environment in production; otherwise this request's origin. */
export function googleRedirectUri(origin: string): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  return configured || `${origin}/api/integrations/google/callback`;
}

export function buildAuthUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "false");
  url.searchParams.set("state", input.state);
  return url.toString();
}

export interface OAuthState {
  appId: string;
  userId: string;
  nonce: string;
  exp: number;
  /** "openmic" for a connect started inside a published app; absent for the dashboard's flow. */
  kind?: "openmic";
}

/**
 * The HMAC key is derived from GOOGLE_TOKEN_ENC_KEY with its own label, so the key that seals refresh tokens is never
 * used directly to sign state.
 */
function stateKey(keyBase64: string): Buffer {
  const raw = Buffer.from(keyBase64, "base64");
  if (raw.length !== 32) throw new Error("GOOGLE_TOKEN_ENC_KEY must be 32 bytes of base64");
  return Buffer.from(hkdfSync("sha256", raw, "tapandlaunch", "oauth-state", 32));
}

/** `base64url(payload).base64url(HMAC-SHA256(payload))`, good for ten minutes from `exp`. */
export function signState(payload: OAuthState, keyBase64: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", stateKey(keyBase64)).update(body).digest("base64url");
  return `${body}.${signature}`;
}

/** The signed fields, or null for anything malformed, tampered with, signed by another key, or expired. */
export function verifyState(
  state: string,
  keyBase64: string,
  now = Date.now()
): { appId: string; userId: string; nonce: string; kind?: "openmic" } | null {
  try {
    const parts = state.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    if (!body || !signature) return null;

    const expected = createHmac("sha256", stateKey(keyBase64)).update(body).digest();
    const given = Buffer.from(signature, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { appId, userId, nonce, exp, kind } = parsed as Record<string, unknown>;
    if (typeof appId !== "string" || appId.length === 0) return null;
    if (typeof userId !== "string" || userId.length === 0) return null;
    if (typeof nonce !== "string" || nonce.length === 0) return null;
    if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
    if (exp <= Math.floor(now / 1000)) return null;
    if (kind !== undefined && kind !== "openmic") return null;

    return kind === "openmic"
      ? { appId, userId, nonce, kind }
      : { appId, userId, nonce };
  } catch {
    return null;
  }
}

/** New states are made with this, so the route and this helper cannot drift apart. */
export function stateExpiry(now = Date.now()): number {
  return Math.floor(now / 1000) + STATE_LIFETIME_SECONDS;
}

/** Google returns granted permissions as one space-separated string; anything else grants nothing. */
export function grantedScopes(scopeField: unknown): string[] {
  if (typeof scopeField !== "string") return [];
  return scopeField
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

type TokenResponse = Record<string, unknown>;

async function postToken(
  fields: Record<string, string>
): Promise<{ ok: true; json: TokenResponse } | { ok: false; json: TokenResponse | null }> {
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const json = (await response.json().catch(() => null)) as TokenResponse | null;
    if (!response.ok || !json) return { ok: false, json };
    return { ok: true, json };
  } catch {
    // A network error and a timeout both mean "try again later".
    return { ok: false, json: null };
  }
}

export async function exchangeCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<
  { ok: true; accessToken: string; refreshToken: string | null; scopes: string[] } | { ok: false }
> {
  const result = await postToken({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  if (!result.ok) return { ok: false };

  const accessToken = result.json.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) return { ok: false };
  const refreshToken =
    typeof result.json.refresh_token === "string" && result.json.refresh_token.length > 0
      ? result.json.refresh_token
      : null;

  return { ok: true, accessToken, refreshToken, scopes: grantedScopes(result.json.scope) };
}

export async function refreshAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ ok: true; accessToken: string; expiresIn: number } | { ok: false; reconnect: boolean }> {
  const result = await postToken({
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
  });
  if (!result.ok) {
    // invalid_grant means the owner revoked access or the token expired at Google: only reconnecting helps.
    return { ok: false, reconnect: result.json?.error === "invalid_grant" };
  }

  const accessToken = result.json.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return { ok: false, reconnect: false };
  }
  const expiresIn = typeof result.json.expires_in === "number" ? result.json.expires_in : 0;
  return { ok: true, accessToken, expiresIn };
}

/** The verified address on the account, lower-cased, or null when Google did not vouch for it. */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json || json.email_verified !== true) return null;
    const email = typeof json.email === "string" ? json.email.trim().toLowerCase() : "";
    return email || null;
  } catch {
    return null;
  }
}

/** Best effort: disconnecting must work even when Google cannot be reached. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    // Nothing to do: the row is deleted either way.
  }
}
