import "server-only";

export type EmailResult = { ok: true } | { ok: false; error: string };

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/**
 * Sends one email via Resend's HTTP API directly — no `resend` SDK
 * dependency, since this is a single `fetch` call with a bearer token.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return { ok: false, error: "Email is not configured (missing RESEND_API_KEY / RESEND_FROM_EMAIL)" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `Resend API error (${res.status}): ${body}` };
  }

  return { ok: true };
}
