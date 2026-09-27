import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/pwa/member-auth";
import {
  clearMemberSessionCookieHeader,
  createMemberSessionToken,
  memberSessionCookieHeader,
} from "@/lib/pwa/member-session";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = LoginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("app_members")
    .select("id, email, display_name, tier, password_hash")
    .eq("app_id", published.app.id)
    .eq("email", parsed.data.email)
    .maybeSingle();

  // Same error either way — "no such account" and "wrong password" are
  // indistinguishable to a caller, which is the point (an email-enumeration
  // guard, not an oversight).
  const invalidCredentials = () => Response.json({ error: "Invalid email or password" }, { status: 401 });

  if (!member) return invalidCredentials();

  const valid = await verifyPassword(parsed.data.password, member.password_hash);
  if (!valid) return invalidCredentials();

  const token = createMemberSessionToken(member.id, published.app.id);
  const response = Response.json({
    member: { id: member.id, email: member.email, display_name: member.display_name, tier: member.tier },
  });
  response.headers.append("Set-Cookie", memberSessionCookieHeader(token));
  return response;
}

export async function DELETE() {
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", clearMemberSessionCookieHeader());
  return response;
}
