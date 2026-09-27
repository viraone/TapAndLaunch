import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/pwa/member-auth";
import { createMemberSessionToken, memberSessionCookieHeader } from "@/lib/pwa/member-session";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  display_name: z.string().max(120).optional(),
});

/** Member signup for a published app. Uses the service-role client — see
 * the README on why `app_members` isn't Supabase Auth. */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = SignupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const passwordHash = await hashPassword(parsed.data.password);

  const { data: member, error } = await admin
    .from("app_members")
    .insert({
      app_id: published.app.id,
      email: parsed.data.email,
      password_hash: passwordHash,
      display_name: parsed.data.display_name,
    })
    .select("id, email, display_name, tier")
    .single();

  if (error) {
    const message = error.code === "23505" ? "An account with that email already exists" : error.message;
    return Response.json({ error: message }, { status: 400 });
  }

  const token = createMemberSessionToken(member.id, published.app.id);
  const response = Response.json({ member }, { status: 201 });
  response.headers.append("Set-Cookie", memberSessionCookieHeader(token));
  return response;
}
