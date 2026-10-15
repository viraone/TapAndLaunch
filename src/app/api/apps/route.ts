import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ABOUT_MAX_LENGTH, DEFAULT_TEMPLATE_ID, buildStarter, isTemplateId, starterTemplateFor } from "@/lib/apps/templates";
import { createAppFromStarter } from "@/lib/apps/create";
import { isAiConfigured } from "@/lib/ai/generate";
import { rewriteStarterCopy } from "@/lib/ai/rewrite";
import { AI_DAILY_LIMIT } from "@/lib/ai/limits";

/** Rewriting a website's words with Claude takes 10 to 20 seconds. */
export const maxDuration = 60;

const CreateAppSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use lowercase letters, numbers, and hyphens only"),
  /** A starter from `lib/apps/templates`, or one design of a topic website (`photography--editorial`); omitted means
   * an empty app. */
  template: z.string().max(80).refine(isTemplateId, "Unknown template").default(DEFAULT_TEMPLATE_ID),
  /** The answer to "What's your site about?" (only asked for a template with `asksAbout: true`); ignored by every
   * other template. */
  about: z.string().max(ABOUT_MAX_LENGTH).optional(),
  /** A photo for the banner, uploaded in the same step (an https address, e.g. the app-assets bucket); only a
   * template with `asksAbout: true` uses it. */
  hero_image: z.string().max(2000).regex(/^https?:\/\//, "The photo must be a web address").optional(),
});

/**
 * Creates an app from a starter template: its pages and blocks come with it. RLS (`is_org_editor`) is the
 * real authorization check here — this route does no membership lookup of
 * its own, so a non-member's insert is rejected by Postgres, not by
 * application logic that could drift out of sync with it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = CreateAppSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { organization_id: organizationId, name, slug, template, about, hero_image } = parsed.data;
  const starter = buildStarter(template, name, about, hero_image);

  // "What's your site about?" + a key: Claude rewrites the words (only the words; see lib/ai/rewrite.ts) for the
  // person described. Checked and counted like "Describe your app" before anything is paid for; over the limit, or
  // not an editor, the site is simply created with the trade's own words.
  if (about && starterTemplateFor(template)?.asksAbout && isAiConfigured()) {
    const { data: membership } = await supabase.from("memberships").select("role").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
    if (membership?.role === "admin" || membership?.role === "creator") {
      const admin = createAdminClient();
      const since = new Date();
      since.setHours(since.getHours() - 24);
      const { count } = await admin.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since.toISOString());
      if ((count ?? 0) < AI_DAILY_LIMIT) {
        await admin.from("ai_generations").insert({ user_id: user.id, organization_id: organizationId });
        const rewritten = await rewriteStarterCopy(starter, about);
        if (rewritten.note) console.warn("website copy kept the template's words:", rewritten.note);
      }
    }
  }

  const result = await createAppFromStarter(supabase, user, { organizationId, name, slug, starter });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ app: result.app }, { status: 201 });
}
