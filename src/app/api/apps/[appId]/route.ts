import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ThemeSchema = z.object({
  primary_color: z.string().optional(),
  background_color: z.string().optional(),
  font_family: z.string().optional(),
  header_title: z.string().max(80).optional(),
  header_tagline: z.string().max(120).optional(),
  header_logo_url: z.string().optional(),
  bottom_nav: z
    .array(z.object({ label: z.string(), icon: z.string(), page_path: z.string() }))
    .optional(),
  color_scheme: z.enum(["light", "dark"]).optional(),
  show_member_bar: z.boolean().optional(),
  bottom_nav_style: z.enum(["compact", "tabs"]).optional(),
});

const ManifestSchema = z.object({
  name: z.string().optional(),
  short_name: z.string().optional(),
  description: z.string().optional(),
  theme_color: z.string().optional(),
  background_color: z.string().optional(),
  display: z.enum(["standalone", "fullscreen", "minimal-ui", "browser"]).optional(),
  icon_url: z.string().optional(),
});

const UpdateAppSchema = z.object({
  theme: ThemeSchema.optional(),
  manifest: ManifestSchema.optional(),
});

/**
 * Partial update for an app's theme/manifest config (the builder's Settings
 * panel). Deliberately not a general-purpose PATCH: `name`/`slug`/`status`
 * have their own routes (`publish`) or aren't editable post-creation yet, so
 * this only ever touches `theme`/`manifest`, whole-object-replace per key —
 * not a deep merge — matching how the Settings dialog sends its full form
 * state on every save.
 */
export async function PATCH(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = UpdateAppSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: app, error } = await supabase
    .from("apps")
    .update(parsed.data)
    .eq("id", appId)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ app });
}
