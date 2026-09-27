import "server-only";
import { sendNotification, setVapidDetails } from "web-push";

// Unlike password hashing (`member-auth.ts`, Node's `crypto.scrypt`) or the
// session token (`member-session.ts`, a plain HMAC), Web Push isn't a
// simple primitive: the message body has to be encrypted per RFC 8291
// (ECDH + HKDF + AES-128-GCM) and the request signed with a VAPID JWT per
// RFC 8292. That's a lot of exacting crypto to hand-roll correctly for
// something `web-push` already does as the de facto standard
// implementation — the tradeoff that favored no dependency elsewhere
// doesn't hold here.

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushResult = { ok: true } | { ok: false; stale: boolean; error: string };

let configured = false;

function ensureConfigured(): boolean {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT } = process.env;
  if (!NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_CONTACT) return false;
  if (!configured) {
    setVapidDetails(VAPID_CONTACT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}

/**
 * Sends one push message. `stale: true` in a failure means the push
 * service reported the subscription is gone (410 Gone / 404 Not Found —
 * the browser unsubscribed, the user cleared site data, etc.) — the
 * caller should delete that `push_subscriptions` row rather than retry it.
 */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<PushResult> {
  if (!ensureConfigured()) {
    return { ok: false, stale: false, error: "Push notifications are not configured (missing VAPID env vars)" };
  }

  try {
    await sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    const stale = statusCode === 404 || statusCode === 410;
    return { ok: false, stale, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
