import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { orgHasMaps } from "@/lib/platform/maps";
import { MAPS_LOCKED_MESSAGE, isMapsBlock } from "@/lib/platform/maps-shared";
import { BLOCK_TYPES } from "@/lib/builder/block-defaults";
import type { BlockType } from "@/types/database";

const BlockSchema = z.object({
  // Every block type the builder knows: one list (`BLOCK_TYPES`), so a new block can never be left out here again.
  type: z.enum(BLOCK_TYPES as [BlockType, ...BlockType[]]),
  position: z.number().int().min(0),
  config: z.record(z.string(), z.unknown()),
  min_tier: z.string().nullable().optional(),
});

const SaveBlocksSchema = z.object({
  blocks: z.array(BlockSchema),
});

/**
 * Replaces every block on a page in one call: deletes the page's existing
 * blocks and inserts the submitted set. Simpler than diffing against what's
 * stored, and safe here specifically because nothing else references a
 * block's id (unlike `pages`/`apps`, which `analytics_events` points at) —
 * so there's no dangling foreign key to worry about from reassigning ids on
 * every save. This does mean concurrent editors of the same page can
 * clobber each other; Phase 1 has no realtime collaboration, so that's an
 * accepted limitation, not an oversight.
 */
export async function PUT(request: Request, context: { params: Promise<{ appId: string; pageId: string }> }) {
  const { appId, pageId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = SaveBlocksSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Live food / Gas prices cost Google money: only organizations a platform
  // admin has switched on may save them. Checked before anything is deleted.
  if (parsed.data.blocks.some((b) => isMapsBlock(b.type))) {
    const { data: app } = await supabase.from("apps").select("organization_id").eq("id", appId).maybeSingle();
    if (!app || !(await orgHasMaps(app.organization_id))) {
      return Response.json({ error: MAPS_LOCKED_MESSAGE }, { status: 403 });
    }
  }

  const { error: deleteError } = await supabase.from("blocks").delete().eq("page_id", pageId);
  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 400 });
  }

  if (parsed.data.blocks.length === 0) {
    return Response.json({ blocks: [] });
  }

  const { data: blocks, error: insertError } = await supabase
    .from("blocks")
    .insert(parsed.data.blocks.map((b) => ({ ...b, page_id: pageId })))
    .select("*")
    .order("position", { ascending: true });

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 400 });
  }

  return Response.json({ blocks });
}
