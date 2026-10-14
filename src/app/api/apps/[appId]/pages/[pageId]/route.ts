import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isReservedPagePath } from "@/lib/pwa/reserved-paths";

const UpdatePageSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  path: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use lowercase letters, numbers, and hyphens only")
    .refine((path) => !isReservedPagePath(path), "That address is used by the app itself. Pick another.")
    .optional(),
  /** The page's place among the app's pages, from 0. The others shift to make room. */
  position: z.number().int().min(0).optional(),
  seo_title: z.string().max(70).nullable().optional(),
  seo_description: z.string().max(200).nullable().optional(),
  share_image_url: z.string().max(2000).nullable().optional(),
});

/** Renames a page, changes its address, or moves it. RLS (`is_org_editor`) decides whether the caller may. */
export async function PATCH(request: Request, context: { params: Promise<{ appId: string; pageId: string }> }) {
  const { appId, pageId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = UpdatePageSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { position, ...fields } = parsed.data;

  if (position !== undefined) {
    const { data: pages, error } = await supabase.from("pages").select("id, position").eq("app_id", appId).order("position");
    if (error) return Response.json({ error: error.message }, { status: 400 });
    const ids = (pages ?? []).map((p) => p.id).filter((id) => id !== pageId);
    if (ids.length === (pages ?? []).length) return Response.json({ error: "Page not found" }, { status: 404 });
    ids.splice(Math.min(position, ids.length), 0, pageId);
    for (const [i, id] of ids.entries()) {
      const { error: moveError } = await supabase.from("pages").update({ position: i }).eq("id", id);
      if (moveError) return Response.json({ error: moveError.message }, { status: 400 });
    }
  }

  const { data: page, error } = await supabase
    .from("pages")
    .update(Object.keys(fields).length ? fields : { updated_at: new Date().toISOString() })
    .eq("id", pageId)
    .eq("app_id", appId)
    .select("*")
    .single();
  if (error) {
    const message = error.code === "23505" ? "Another page already has that address" : error.message;
    return Response.json({ error: message }, { status: 400 });
  }
  return Response.json({ page });
}

/** Deletes a page and its sections. The home page can't be deleted: the app always has one. */
export async function DELETE(_request: Request, context: { params: Promise<{ appId: string; pageId: string }> }) {
  const { appId, pageId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: page } = await supabase.from("pages").select("id, is_home").eq("id", pageId).eq("app_id", appId).maybeSingle();
  if (!page) return Response.json({ error: "Page not found" }, { status: 404 });
  if (page.is_home) return Response.json({ error: "The home page can't be deleted." }, { status: 400 });

  const { error } = await supabase.from("pages").delete().eq("id", pageId);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
