import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { GalleryBlockConfig } from "@/types/database";

/** The most photos one gallery shows. */
export const GALLERY_MAX_PHOTOS = 24;

const AddSchema = z.object({ urls: z.array(z.string().url().max(2000)).min(1).max(GALLERY_MAX_PHOTOS) });
const RemoveSchema = z.object({ url: z.string().url().max(2000) });

/**
 * The app's photo gallery, for Quick updates: the first Photo gallery block of the app (the home page's first). Pages
 * are read through the signed-in person's session, so RLS decides whether they may touch this app at all.
 */
async function findGallery(supabase: Awaited<ReturnType<typeof createClient>>, appId: string) {
  const { data: pages } = await supabase.from("pages").select("id, is_home, position").eq("app_id", appId).order("position");
  const ordered = [...(pages ?? [])].sort((a, b) => Number(b.is_home) - Number(a.is_home));
  if (ordered.length === 0) return { pages: ordered, block: null };
  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, page_id, position, config")
    .in("page_id", ordered.map((p) => p.id))
    .eq("type", "gallery")
    .order("position");
  const byPage = new Map(ordered.map((p, i) => [p.id, i]));
  const block = (blocks ?? []).sort((a, b) => (byPage.get(a.page_id) ?? 0) - (byPage.get(b.page_id) ?? 0) || a.position - b.position)[0] ?? null;
  return { pages: ordered, block };
}

/** The gallery's photos, oldest first. */
export async function GET(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const { block } = await findGallery(supabase, appId);
  const images = ((block?.config as GalleryBlockConfig | undefined)?.images ?? []).filter((i) => i.src);
  return Response.json({ images, max: GALLERY_MAX_PHOTOS });
}

/** Adds photos (already uploaded; their addresses) to the gallery, creating one on the home page if the app has none. */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = AddSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const { pages, block } = await findGallery(supabase, appId);
  const existing = ((block?.config as GalleryBlockConfig | undefined)?.images ?? []).filter((i) => i.src);
  const additions = parsed.data.urls.filter((url) => !existing.some((i) => i.src === url)).map((src) => ({ src, alt: "" }));
  const images = [...existing, ...additions].slice(0, GALLERY_MAX_PHOTOS);
  const dropped = existing.length + additions.length - images.length;

  if (block) {
    const config: GalleryBlockConfig = { ...(block.config as GalleryBlockConfig), images };
    const { error } = await supabase.from("blocks").update({ config }).eq("id", block.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  } else {
    const home = pages[0];
    if (!home) return Response.json({ error: "This app has no pages yet." }, { status: 400 });
    const { count } = await supabase.from("blocks").select("id", { count: "exact", head: true }).eq("page_id", home.id);
    const config: GalleryBlockConfig = { title: "Photos", images };
    const { error } = await supabase.from("blocks").insert({ page_id: home.id, type: "gallery", position: count ?? 0, config });
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ images, dropped, max: GALLERY_MAX_PHOTOS });
}

/** Removes one photo from the gallery (the file itself stays in storage). */
export async function DELETE(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = RemoveSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const { block } = await findGallery(supabase, appId);
  if (!block) return Response.json({ error: "This app has no photo gallery." }, { status: 404 });
  const current = block.config as GalleryBlockConfig;
  const images = (current.images ?? []).filter((i) => i.src !== parsed.data.url);
  const { error } = await supabase.from("blocks").update({ config: { ...current, images } }).eq("id", block.id);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ images });
}
