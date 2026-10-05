import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppAdmin } from "@/lib/org";
import { confirmationMatches } from "@/lib/apps/deletion";
import { removeDomain } from "@/lib/domains/vercel";

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

/**
 * Deletes an app, with a 30-day undo: it is hidden and unpublished at once, its custom domain is detached from
 * Vercel, and a daily job erases it for good after 30 days (see migration 0026). Admins only, and the app's name
 * must be typed as confirmation. The writes use the service role because the database rules deliberately hide
 * a deleted app from everyone, including the person deleting it.
 */
export async function DELETE(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  if (!(await isAppAdmin(supabase, appId))) {
    return Response.json({ error: "Only an organization admin can delete an app" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { confirmName?: unknown } | null;
  const admin = createAdminClient();
  const { data: app } = await admin.from("apps").select("id, name, custom_domain").eq("id", appId).is("deleted_at", null).maybeSingle();
  if (!app) return Response.json({ error: "Not found" }, { status: 404 });

  if (!confirmationMatches(body?.confirmName, app.name)) {
    return Response.json({ error: "Type the app's name exactly to confirm" }, { status: 400 });
  }

  // Detach the domain first: if Vercel can't be reached the app stays as it was, rather than leaving a domain behind.
  if (app.custom_domain) {
    const removed = await removeDomain(app.custom_domain);
    if (!removed.ok) {
      return Response.json({ error: `Couldn't remove the custom domain: ${removed.error ?? "try again"}` }, { status: 502 });
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await admin
    .from("apps")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id ?? null,
      status: "draft",
      custom_domain: null,
      custom_domain_status: null,
      custom_domain_verification: [],
    })
    .eq("id", appId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
