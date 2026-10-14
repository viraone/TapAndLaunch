import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/pwa/member-auth";

const Schema = z.object({ email: z.string().trim().email().max(200) });

/**
 * The Newsletter section's sign-up: the person becomes one of the app's members (without a password they could use;
 * they can set one later through "Forgot password" if the app has member sign-in), so the owner can write to them
 * from Notifications > Email, and they can unsubscribe from any email.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That doesn't look like an email address" }, { status: 400 });

  const email = parsed.data.email.toLowerCase();
  const admin = createAdminClient();
  const { data: existing } = await admin.from("app_members").select("id").eq("app_id", published.app.id).eq("email", email).maybeSingle();
  if (existing) return Response.json({ ok: true, already: true });

  const { error } = await admin.from("app_members").insert({
    app_id: published.app.id,
    email,
    password_hash: await hashPassword(crypto.randomUUID()),
    display_name: null,
  });
  if (error) return Response.json({ error: "Couldn't sign you up right now" }, { status: 500 });
  return Response.json({ ok: true });
}
