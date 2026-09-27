import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const MEMBER_SESSION_COOKIE = "beezer_member";

function getSecret(): string {
  const secret = process.env.MEMBER_SESSION_SECRET;
  if (!secret) {
    throw new Error("MEMBER_SESSION_SECRET is not set — see .env.local.example");
  }
  return secret;
}

/**
 * A minimal HMAC-signed session token (`base64url(payload).base64url(sig)`)
 * — not a JWT library, because the shape here is fixed and tiny (two
 * fields) and doesn't need one. Bound to `appId` as well as `memberId` so a
 * token can't be replayed against a different app even though, in
 * practice, same-origin cookie scoping (each app is served from its own
 * subdomain) already prevents that — this is defense in depth, not the
 * only guard.
 */
export function createMemberSessionToken(memberId: string, appId: string): string {
  const payload = Buffer.from(JSON.stringify({ memberId, appId })).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

/** Returns the member id if `token` is validly signed and was minted for `appId`, else null. */
export function verifyMemberSessionToken(token: string, appId: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  const actual = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actual.length !== expectedBuf.length || !timingSafeEqual(actual, expectedBuf)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      memberId: string;
      appId: string;
    };
    return data.appId === appId ? data.memberId : null;
  } catch {
    return null;
  }
}

/** `Set-Cookie` header value for signing a member in. Root-relative (`Path=/`)
 * since a member's session should cover every page of the app, not just the
 * one they signed in from. */
export function memberSessionCookieHeader(token: string): string {
  return `${MEMBER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}

/** `Set-Cookie` header value that clears the member session (sign-out). */
export function clearMemberSessionCookieHeader(): string {
  return `${MEMBER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
