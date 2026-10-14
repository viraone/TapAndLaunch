import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { NO_AI_MESSAGE, resolveAsker } from "@/lib/ai/ask";
import { countUsage } from "@/lib/ai/usage";
import { describeSite, loadSite } from "@/lib/ai/site-context";
import { editSectionCopy } from "@/lib/ai/edit-section";
import { BLOCK_TYPES } from "@/lib/builder/block-defaults";
import type { BlockType } from "@/types/database";

const Schema = z.object({
  type: z.enum(BLOCK_TYPES as [BlockType, ...BlockType[]]),
  config: z.record(z.string(), z.unknown()),
  instruction: z.string().trim().min(2).max(600),
});

export const maxDuration = 60;

/**
 * Cmd+K on a section. The builder sends the section as it is on screen (it may be newer than what is saved) and the
 * owner's instruction; the words come back changed and nothing else. Nothing is saved here: the builder applies the
 * result like any other edit, so it autosaves and sits in the undo history with a Keep / Undo pair on the page.
 */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "You can't edit this app" }, { status: 403 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Say what should change, in a few words." }, { status: 400 });

  const site = await loadSite(supabase, appId);
  if (!site) return Response.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const asker = await resolveAsker(admin, site.app.organization_id);
  if (!asker) return Response.json({ error: NO_AI_MESSAGE, needsKey: true }, { status: 400 });
  const over = await countUsage(admin, { userId: user.id, organizationId: site.app.organization_id, kind: "edit", details: { app_id: appId, source: asker.source } });
  if (over) return Response.json({ error: over }, { status: 429 });

  const result = await editSectionCopy({ type: parsed.data.type, config: parsed.data.config, instruction: parsed.data.instruction, site: describeSite(site), ask: asker.ask });
  if (result.changed === 0) return Response.json({ error: result.note ?? "Nothing changed." }, { status: 422 });
  return Response.json({ config: result.config, changed: result.changed });
}
