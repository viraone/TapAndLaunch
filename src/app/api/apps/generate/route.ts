import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAppFromStarter } from "@/lib/apps/create";
import { slugify } from "@/lib/apps/slug";
import { generateApp, isAiConfigured } from "@/lib/ai/generate";
import { AI_DAILY_LIMIT, AI_LIMIT_MESSAGE } from "@/lib/ai/limits";
import { MAX_DESCRIPTION, MIN_DESCRIPTION } from "@/lib/ai/app-spec";

const Schema = z.object({
  organization_id: z.string().uuid(),
  description: z.string().trim().min(MIN_DESCRIPTION, "Tell us a little more: a sentence or two is perfect.").max(MAX_DESCRIPTION, `Keep it under ${MAX_DESCRIPTION} characters.`),
  name: z.string().trim().max(60).optional(),
});

/**
 * "Describe your app in a sentence": designs a first version (with Claude when a key is set, otherwise by matching the
 * closest template), then creates it exactly like the template picker does. Only editors of the organization can use it,
 * and each person gets a daily limit, both checked before any model call is paid for.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { organization_id: organizationId, description, name } = parsed.data;

  const { data: membership } = await supabase.from("memberships").select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
  if (membership?.role !== "admin" && membership?.role !== "creator") {
    return Response.json({ error: "You can't create apps in this organization" }, { status: 403 });
  }

  if (isAiConfigured()) {
    const admin = createAdminClient();
    const since = new Date();
    since.setHours(since.getHours() - 24);
    const { count } = await admin.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since.toISOString());
    if ((count ?? 0) >= AI_DAILY_LIMIT) return Response.json({ error: AI_LIMIT_MESSAGE }, { status: 429 });
    await admin.from("ai_generations").insert({ user_id: user.id, organization_id: organizationId });
  }

  const generated = await generateApp({ description, name });
  if (generated.note) console.warn("app generation used a template:", generated.note);

  const result = await createAppFromStarter(supabase, user, {
    organizationId,
    name: generated.name,
    slug: slugify(generated.name) || "my-app",
    starter: generated.starter,
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ app: result.app, source: generated.source }, { status: 201 });
}
