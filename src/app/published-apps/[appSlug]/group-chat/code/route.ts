import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { findChatMember, normalizeChatEmail } from "@/lib/chat/access";
import {
  generateLoginCode,
  hashLoginCode,
  LOGIN_CODE_TTL_MS,
  MAX_LOGIN_CODES_PER_HOUR,
} from "@/lib/chat/login-codes";
import { isEmailConfigured, sendEmailBatch } from "@/lib/notifications/email";
import { escapeHtml, fromHeader } from "@/lib/notifications/email-content";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const Schema = z.object({ email: z.string().trim().email().max(200) });

/**
 * Emails a six-digit sign-in code to an address on this app's group-chat allowlist. Like the messages route, all
 * table access is service-role: the browser never sees the allowlist, and a 403 here is the only way it learns an
 * address is not on the list.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { state: "invalid_email", message: "That doesn't look like an email address." },
      { status: 400, headers: NO_STORE }
    );
  }

  const email = normalizeChatEmail(parsed.data.email);
  const admin = createAdminClient();
  const allowlist = await findChatMember(admin, published.app.id, email);
  if (!allowlist) {
    return Response.json(
      { state: "not_on_list", message: "That email isn't on the class list. Ask your teacher." },
      { status: 403, headers: NO_STORE }
    );
  }

  // Five codes per address per hour, whether or not the earlier ones were used.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("group_chat_login_codes")
    .select("id", { count: "exact", head: true })
    .eq("app_id", published.app.id)
    .eq("email", email)
    .gte("created_at", since);
  if (countError) {
    console.error("Group chat login codes could not be counted:", countError.message);
    return Response.json({ state: "error", message: "Couldn't send a code right now. Try again." }, { status: 500, headers: NO_STORE });
  }
  if ((count ?? 0) >= MAX_LOGIN_CODES_PER_HOUR) {
    return Response.json(
      { state: "rate_limited", message: "Too many codes sent to that email. Try again in a little while." },
      { status: 429, headers: NO_STORE }
    );
  }

  const secret = process.env.MEMBER_SESSION_SECRET;
  if (!isEmailConfigured() || !secret) {
    console.error("Group chat login code not sent: email or MEMBER_SESSION_SECRET is not configured.");
    return Response.json({ state: "error", message: "Email isn't set up right now. Try again later." }, { status: 500, headers: NO_STORE });
  }

  const code = generateLoginCode();
  const { data: row, error: insertError } = await admin
    .from("group_chat_login_codes")
    .insert({
      app_id: published.app.id,
      email,
      code_hash: hashLoginCode(code, secret),
      expires_at: new Date(Date.now() + LOGIN_CODE_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (insertError || !row) {
    console.error("Group chat login code could not be saved:", insertError?.message);
    return Response.json({ state: "error", message: "Couldn't send a code right now. Try again." }, { status: 500, headers: NO_STORE });
  }

  const html = `<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:480px">
<p style="margin:0 0 12px">Your chat code for ${escapeHtml(published.app.name)}:</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
<p style="margin:0 0 12px">It works for 10 minutes.</p>
<p style="margin:0;color:#6e6e73">If you didn't ask for this, you can ignore this email.</p>
</div>`;

  const result = await sendEmailBatch(fromHeader(published.app.name, process.env.RESEND_FROM_EMAIL as string), [
    { to: email, subject: `${code} is your ${published.app.name} chat code`, html },
  ]);
  if (result.sent === 0) {
    // A code nobody received must not count against the hour's five (or sit there waiting to be guessed).
    await admin.from("group_chat_login_codes").delete().eq("id", row.id);
    return Response.json({ state: "error", message: "We couldn't send the email. Try again." }, { status: 500, headers: NO_STORE });
  }

  return Response.json({ state: "sent" }, { headers: NO_STORE });
}
