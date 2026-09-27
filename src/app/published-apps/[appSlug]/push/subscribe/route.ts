import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/pwa/get-current-member";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

/**
 * Records a browser's push subscription. Associates it with the current
 * member if the visitor is signed in (optional — see `push_subscriptions`'s
 * nullable `member_id`) so tier-targeted sends can reach them; anonymous
 * subscriptions only ever get "all" sends.
 *
 * Upserts on `endpoint` (globally unique) rather than inserting blindly: a
 * browser's existing subscription is reused across visits, and re-
 * subscribing after signing in should attach the member to the same row,
 * not create a duplicate.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = SubscribeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const member = await getCurrentMember(published.app.id);

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      app_id: published.app.id,
      member_id: member?.id ?? null,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
