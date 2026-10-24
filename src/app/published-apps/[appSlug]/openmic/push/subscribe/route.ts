import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { comicFromToken, showProjectFor } from "@/lib/openmic/push-server";
import { nameKey } from "@/lib/openmic/push";

const SubscribeSchema = z.object({
  /** The comic's access token from the show's own Supabase project. */
  token: z.string().min(20),
  /** The stage name to match against the lineup; the email stands in when the profile has none. */
  name: z.string().max(120).optional(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
});

/**
 * A comic's phone signs up for "You're up next!" pushes (StageTime). Upserts on the endpoint, so the same phone
 * re-sent with a new name (the exact lineup-row name on show day, say) updates its row instead of adding one.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = SubscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const project = await showProjectFor(published.app.id);
  if (!project) return Response.json({ error: "This app has no open mic sign-up" }, { status: 404 });
  const comic = await comicFromToken(project, parsed.data.token);
  if (!comic) return Response.json({ error: "Sign in again" }, { status: 401 });

  const name = parsed.data.name?.trim() || comic.email;
  const admin = createAdminClient();
  const { error } = await admin.from("openmic_push_subscriptions").upsert(
    {
      app_id: published.app.id,
      user_id: comic.id,
      email: comic.email,
      name,
      name_key: nameKey(name),
      endpoint: parsed.data.subscription.endpoint,
      p256dh: parsed.data.subscription.keys.p256dh,
      auth: parsed.data.subscription.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true }, { status: 201 });
}
