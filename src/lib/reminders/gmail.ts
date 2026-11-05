const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/**
 * Sends one already-built message through the connected Gmail account.
 *
 * Never logs the token or the message. A 15-second timeout keeps a stuck request from hanging the page. A network
 * failure is reported as status 0 so the caller can tell it apart from an HTTP answer.
 */
export async function sendViaGmail(
  accessToken: string,
  raw: string
): Promise<{ ok: true } | { ok: false; status: number }> {
  try {
    const response = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      signal: AbortSignal.timeout(15000),
    });

    return response.ok ? { ok: true } : { ok: false, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
