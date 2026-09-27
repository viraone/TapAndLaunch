import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreateAppSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use lowercase letters, numbers, and hyphens only"),
});

/**
 * Creates an app and its first page ("Home"). RLS (`is_org_editor`) is the
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

  const { data: app, error: appError } = await supabase
    .from("apps")
    .insert({
      organization_id: parsed.data.organization_id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (appError) {
    const message = appError.code === "23505" ? "That subdomain is already taken" : appError.message;
    return Response.json({ error: message }, { status: 400 });
  }

  const { error: pageError } = await supabase
    .from("pages")
    .insert({ app_id: app.id, name: "Home", path: "home", is_home: true, position: 0 });

  if (pageError) {
    return Response.json({ error: pageError.message }, { status: 400 });
  }

  return Response.json({ app }, { status: 201 });
}
