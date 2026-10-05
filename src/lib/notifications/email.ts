import "server-only";
import { chunk } from "./email-content";

export type EmailResult = { ok: true } | { ok: false; error: string };

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
}

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/** Resend accepts at most 100 emails per batch call. */
const BATCH_SIZE = 100;

/**
 * Sends emails through Resend's batch API (100 per request) — no `resend` SDK, just `fetch` with a bearer
 * token. One request per 100 recipients keeps well inside Resend's rate limit, which one-request-per-person
 * would not. A batch succeeds or fails as a whole, so a failure counts every email in it as failed.
 */
export async function sendEmailBatch(from: string, emails: OutgoingEmail[]): Promise<{ sent: number; failed: number; error?: string }> {
  const { RESEND_API_KEY } = process.env;
  if (!RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return { sent: 0, failed: emails.length, error: "Email is not configured (missing RESEND_API_KEY / RESEND_FROM_EMAIL)" };
  }

  let sent = 0;
  let failed = 0;
  let error: string | undefined;
  for (const group of chunk(emails, BATCH_SIZE)) {
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(group.map((e) => ({ from, to: [e.to], subject: e.subject, html: e.html, headers: e.headers }))),
      });
      if (res.ok) {
        sent += group.length;
      } else {
        failed += group.length;
        error ??= `Resend API error (${res.status}): ${await res.text()}`;
      }
    } catch (e) {
      failed += group.length;
      error ??= e instanceof Error ? e.message : "Could not reach Resend";
    }
  }
  if (error) console.error("email send failed:", error);
  return { sent, failed, error };
}
