import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEMPLATE_ID, STARTER_TEMPLATES, buildStarter } from "@/lib/apps/templates";

const CreateAppSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use lowercase letters, numbers, and hyphens only"),
  /** A starter from `lib/apps/templates`; omitted means an empty app. */
  template: z.enum(STARTER_TEMPLATES.map((t) => t.id) as [string, ...string[]]).default(DEFAULT_TEMPLATE_ID),
});

/** `maple` → `maple`, `maple-2`, `maple-3`… for when the address is taken. */
function slugCandidates(slug: string): string[] {
  return [slug, ...[2, 3, 4, 5].map((n) => `${slug.slice(0, 60)}-${n}`)];
}

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

  const starter = buildStarter(parsed.data.template, parsed.data.name);

  let app = null;
  let appError: { code?: string; message: string } | null = null;
  for (const slug of slugCandidates(parsed.data.slug)) {
    const result = await supabase
      .from("apps")
      .insert({
        organization_id: parsed.data.organization_id,
        name: parsed.data.name,
        slug,
        theme: starter.theme,
        manifest: starter.manifest,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (!result.error) {
      app = result.data;
      appError = null;
      break;
    }
    appError = result.error;
    if (result.error.code !== "23505") break; // only "taken" is worth another number
  }
  if (!app) {
    const message = appError?.code === "23505" ? "That address is already taken. Try a different name." : (appError?.message ?? "Could not create the app");
    return Response.json({ error: message }, { status: 400 });
  }

  // If any later step fails, remove the half-built app so the customer
  // doesn't end up with an empty one they never asked for.
  const fail = async (message: string) => {
    await supabase.from("apps").delete().eq("id", app.id);
    return Response.json({ error: message }, { status: 400 });
  };

  const { data: pages, error: pageError } = await supabase
    .from("pages")
    .insert(starter.pages.map((p, position) => ({ app_id: app.id, name: p.name, path: p.path, is_home: p.isHome, position })))
    .select("id, path");
  if (pageError || !pages) return fail(pageError?.message ?? "Could not create the pages");

  const blockRows = starter.pages.flatMap((p) => {
    const pageId = pages.find((row) => row.path === p.path)?.id;
    return pageId ? p.blocks.map((b, position) => ({ page_id: pageId, type: b.type, position, config: b.config })) : [];
  });
  if (blockRows.length) {
    const { error: blockError } = await supabase.from("blocks").insert(blockRows);
    if (blockError) return fail(blockError.message);
  }

  return Response.json({ app }, { status: 201 });
}
