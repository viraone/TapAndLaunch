import "server-only";

export type SmsResult = { ok: true } | { ok: false; error: string };

export function isSmsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

/**
 * Sends one SMS via Twilio's HTTP API directly — no `twilio` SDK
 * dependency, since this is a single form-encoded `fetch` call with Basic
 * auth.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return { ok: false, error: "SMS is not configured (missing TWILIO_* env vars)" };
  }

  const credentials = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }),
  });

  if (!res.ok) {
    const responseBody = await res.text();
    return { ok: false, error: `Twilio API error (${res.status}): ${responseBody}` };
  }

  return { ok: true };
}
