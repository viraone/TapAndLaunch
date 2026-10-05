import { createHmac, timingSafeEqual } from "node:crypto";

/** Escapes text for use inside HTML, so a merchant's message can never add tags or links of its own. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * `"App name" <noreply@tapandlaunch.com>`: each email names the app it came from. The address is whatever
 * `RESEND_FROM_EMAIL` holds (a bare address or `Name <address>`); only the display name changes.
 */
export function fromHeader(appName: string, configured: string): string {
  const address = /<([^>]+)>/.exec(configured)?.[1] ?? configured.trim();
  const name = appName.replace(/["<>\\\r\n]/g, "").trim();
  return name ? `"${name}" <${address}>` : address;
}

export interface EmailContent {
  appName: string;
  title: string;
  body: string;
  unsubscribeUrl: string;
}

/** A plain, centered email: the title, the message (line breaks kept), and a footer with the unsubscribe link. */
export function renderEmailHtml({ appName, title, body, unsubscribeUrl }: EmailContent): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f5f7;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="margin:0 0 20px;font-size:13px;color:#6e6e73">${escapeHtml(appName)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25">${escapeHtml(title)}</h1>
<div style="font-size:16px;line-height:1.5">${paragraphs}</div>
</div>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#6e6e73;text-align:center">You're getting this because you have an account with ${escapeHtml(appName)}.<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6e6e73">Unsubscribe</a></p>
</body></html>`;
}

/** Splits a list into groups of at most `size` (Resend takes up to 100 emails per batch call). */
export function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

/** The signed token in an unsubscribe link: proves the link was made by us for this member, with no login needed. */
export function signUnsubscribe(memberId: string, secret: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:${memberId}`).digest("base64url");
}

export function verifyUnsubscribe(memberId: string, token: string, secret: string): boolean {
  const expected = Buffer.from(signUnsubscribe(memberId, secret));
  const actual = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
