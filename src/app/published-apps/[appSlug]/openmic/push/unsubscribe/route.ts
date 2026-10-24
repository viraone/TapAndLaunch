import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { comicFromToken, showProjectFor } from "@/lib/openmic/push-server";

const UnsubscribeSchema = z.object({
  token: z.string().min(20),
  endpoint: z.string().url(),
});

/** A comic's phone turns "You're up next!" pushes off: only its own row (same comic, same endpoint) goes. */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = UnsubscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const project = await showProjectFor(published.app.id);
  if (!project) return Response.json({ error: "This app has no open mic sign-up" }, { status: 404 });
  const comic = await comicFromToken(project, parsed.data.token);
  if (!comic) return Response.json({ error: "Sign in again" }, { status: 401 });

  const admin = createAdminClient();
  await admin.from("openmic_push_subscriptions").delete().eq("app_id", published.app.id).eq("user_id", comic.id).eq("endpoint", parsed.data.endpoint);
  return Response.json({ ok: true });
}
