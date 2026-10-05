import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEMPLATE_ID, STARTER_TEMPLATES, buildStarter } from "@/lib/apps/templates";
import { createAppFromStarter } from "@/lib/apps/create";

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

  const result = await createAppFromStarter(supabase, user, {
    organizationId: parsed.data.organization_id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    starter: buildStarter(parsed.data.template, parsed.data.name),
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ app: result.app }, { status: 201 });
}
