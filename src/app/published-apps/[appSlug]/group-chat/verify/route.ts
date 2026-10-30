import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/pwa/member-auth";
import { createMemberSessionToken, memberSessionCookieHeader } from "@/lib/pwa/member-session";
import { findChatMember, normalizeChatEmail } from "@/lib/chat/access";
import { MAX_LOGIN_CODE_ATTEMPTS, verifyLoginCode } from "@/lib/chat/login-codes";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const Schema = z.object({
  email: z.string().trim().email().max(200),
  code: z.string().trim().regex(/^\d{6}$/),
});

type Admin = ReturnType<typeof createAdminClient>;

/** The account for this app and address, matched lower-cased the way the allowlist is. */
async function findMember(admin: Admin, appId: string, email: string) {
  const { data } = await admin.from("app_members").select("id, email").eq("app_id", appId);
  return (data ?? []).find((member) => normalizeChatEmail(member.email) === email) ?? null;
}

/**
 * Signs a student in with the six-digit code from their email. A correct code is marked used first (so it cannot be
 * replayed), then the person's `app_members` account is found — or created with the allowlist's display name and a
 * random password, which nobody knows — and the ordinary member session cookie is set. From then on the messages
 * route and `getCurrentMember` work exactly as they do for a password sign-in.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { state: "bad_code", message: "Type the 6-digit code from the email." },
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

  const { data: row, error: rowError } = await admin
    .from("group_chat_login_codes")
    .select("id, code_hash, attempts")
    .eq("app_id", published.app.id)
    .eq("email", email)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rowError) {
    console.error("Group chat login code could not be read:", rowError.message);
    return Response.json({ state: "error", message: "Couldn't sign you in. Try again." }, { status: 500, headers: NO_STORE });
  }
  if (!row) {
    return Response.json(
      { state: "expired", message: "That code has expired. Send a new one." },
      { status: 400, headers: NO_STORE }
    );
  }
  if (row.attempts >= MAX_LOGIN_CODE_ATTEMPTS) {
    return Response.json(
      { state: "too_many_attempts", message: "Too many tries. Send a new code." },
      { status: 429, headers: NO_STORE }
    );
  }

  const secret = process.env.MEMBER_SESSION_SECRET;
  if (!secret) {
    console.error("Group chat login code not checked: MEMBER_SESSION_SECRET is not configured.");
    return Response.json({ state: "error", message: "Couldn't sign you in. Try again." }, { status: 500, headers: NO_STORE });
  }

  if (!verifyLoginCode(parsed.data.code, row.code_hash, secret)) {
    const attempts = row.attempts + 1;
    await admin.from("group_chat_login_codes").update({ attempts }).eq("id", row.id).is("used_at", null);
    if (attempts >= MAX_LOGIN_CODE_ATTEMPTS) {
      return Response.json(
        { state: "too_many_attempts", message: "Too many tries. Send a new code." },
        { status: 429, headers: NO_STORE }
      );
    }
    return Response.json(
      { state: "bad_code", message: "That code isn't right. Check the email and try again." },
      { status: 400, headers: NO_STORE }
    );
  }

  // One correct code, one use: the conditional update is what stops a replay if two requests race.
  const { data: marked, error: markError } = await admin
    .from("group_chat_login_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id");
  if (markError) {
    console.error("Group chat login code could not be marked used:", markError.message);
    return Response.json({ state: "error", message: "Couldn't sign you in. Try again." }, { status: 500, headers: NO_STORE });
  }
  if (!marked || marked.length === 0) {
    return Response.json(
      { state: "expired", message: "That code has already been used. Send a new one." },
      { status: 400, headers: NO_STORE }
    );
  }

  let member = await findMember(admin, published.app.id, email);
  if (!member) {
    const { data: created, error: createError } = await admin
      .from("app_members")
      .insert({
        app_id: published.app.id,
        email,
        // A random password nobody is told: the account is reachable only through a fresh email code.
        password_hash: await hashPassword(randomUUID()),
        display_name: allowlist.display_name,
      })
      .select("id, email")
      .single();
    if (createError || !created) {
      // Another request may have created the account between the lookup and this insert.
      if (createError?.code === "23505") member = await findMember(admin, published.app.id, email);
      if (!member) {
        console.error("Group chat member could not be created:", createError?.message);
        return Response.json({ state: "error", message: "Couldn't sign you in. Try again." }, { status: 500, headers: NO_STORE });
      }
    } else {
      member = created;
    }
  }

  const response = Response.json({ state: "ok" }, { headers: NO_STORE });
  response.headers.append("Set-Cookie", memberSessionCookieHeader(createMemberSessionToken(member.id, published.app.id)));
  return response;
}
