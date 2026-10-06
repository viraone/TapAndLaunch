import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { decryptSecret } from "@/lib/ai/keys";
import { isProviderError, chatJson, type AiProvider } from "@/lib/ai/providers";
import { parseModelJson } from "@/lib/ai/app-spec";
import { AiReply, BUILDER_SYSTEM_PROMPT, applyOperations, buildContext, type Draft } from "@/lib/ai/builder-ops";
import type { BlockConfig, BlockType, ThemeConfig } from "@/types/database";

/** Messages one person can send to the builder chat in an hour: a guard against a runaway loop on their own bill. */
const CHAT_HOURLY_LIMIT = 40;

const Schema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(12).default([]),
});

export const maxDuration = 60;

/**
 * "BYOB: Bring your own bot". The owner's message goes to their own AI key with the app's current pages and blocks; the
 * model answers with small changes, which are checked (`AiReply`), applied to a copy (`applyOperations`), and saved with
 * the owner's own session, so the database's own rules apply to every write.
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
  if (!parsed.success) return Response.json({ error: "Type a message (up to 1,000 characters)" }, { status: 400 });

  const { data: app } = await supabase.from("apps").select("id, name, organization_id, theme").eq("id", appId).maybeSingle();
  if (!app) return Response.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: keyRow } = await admin.from("org_ai_keys").select("provider, encrypted_key, model").eq("organization_id", app.organization_id).maybeSingle();
  if (!keyRow) return Response.json({ error: "Add your AI key first.", needsKey: true }, { status: 400 });

  const since = new Date();
  since.setHours(since.getHours() - 1);
  const { count } = await admin.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", "chat").gte("created_at", since.toISOString());
  if ((count ?? 0) >= CHAT_HOURLY_LIMIT) return Response.json({ error: `That's ${CHAT_HOURLY_LIMIT} messages this hour. Take a short break and try again.` }, { status: 429 });
  await admin.from("ai_generations").insert({ user_id: user.id, organization_id: app.organization_id, kind: "chat" });

  // The app as it is saved now.
  const { data: pages } = await supabase.from("pages").select("id, name, path, is_home, position").eq("app_id", appId).order("position", { ascending: true });
  const pageIds = (pages ?? []).map((p) => p.id);
  const { data: blocks } = pageIds.length
    ? await supabase.from("blocks").select("page_id, type, config, min_tier, position").in("page_id", pageIds).order("position", { ascending: true })
    : { data: [] };
  const draft: Draft = {
    theme: app.theme as ThemeConfig,
    pages: (pages ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      isHome: p.is_home,
      blocks: (blocks ?? []).filter((b) => b.page_id === p.id).map((b) => ({ type: b.type as BlockType, config: b.config as BlockConfig, min_tier: b.min_tier })),
    })),
  };

  let reply;
  try {
    const text = await chatJson(keyRow.provider as AiProvider, decryptSecret(keyRow.encrypted_key), keyRow.model, BUILDER_SYSTEM_PROMPT, [
      ...parsed.data.history,
      { role: "user", content: `Current app:\n${buildContext(app.name, draft)}\n\n<owner>${parsed.data.message.replace(/<\/?owner>/gi, "")}</owner>` },
    ]);
    const checked = AiReply.safeParse(parseModelJson(text));
    if (!checked.success) return Response.json({ error: "The AI's answer couldn't be used. Try saying it a different way." }, { status: 502 });
    reply = checked.data;
  } catch (error) {
    if (isProviderError(error)) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ error: "The AI didn't answer in time. Try a smaller request." }, { status: 504 });
  }

  const { draft: next, applied, skipped } = applyOperations(draft, reply.ops);
  if (applied > 0) {
    const saved = await saveDraft(supabase, appId, draft, next);
    if (saved) return Response.json({ error: `Couldn't save the changes: ${saved}` }, { status: 500 });
  }
  return Response.json({ reply: reply.reply, applied, skipped });
}

/** Writes only what changed: removed pages, new pages, pages whose blocks changed, and the theme. Returns an error message, or null. */
async function saveDraft(supabase: Awaited<ReturnType<typeof createClient>>, appId: string, before: Draft, after: Draft): Promise<string | null> {
  const removed = before.pages.filter((p) => p.id && !after.pages.some((q) => q.id === p.id));
  if (removed.length) {
    const { error } = await supabase.from("pages").delete().in("id", removed.map((p) => p.id as string));
    if (error) return error.message;
  }
  for (const [position, page] of after.pages.entries()) {
    let pageId = page.id;
    if (!pageId) {
      const { data, error } = await supabase.from("pages").insert({ app_id: appId, name: page.name, path: page.path, is_home: false, position }).select("id").single();
      if (error || !data) return error?.message ?? "Couldn't add a page";
      pageId = data.id;
    }
    const old = before.pages.find((p) => p.id === page.id);
    if (old && JSON.stringify(old.blocks) === JSON.stringify(page.blocks)) continue;
    const { error: deleteError } = await supabase.from("blocks").delete().eq("page_id", pageId);
    if (deleteError) return deleteError.message;
    if (page.blocks.length) {
      const { error } = await supabase.from("blocks").insert(page.blocks.map((b, i) => ({ page_id: pageId as string, type: b.type, config: b.config, min_tier: b.min_tier, position: i })));
      if (error) return error.message;
    }
  }
  if (JSON.stringify(before.theme) !== JSON.stringify(after.theme)) {
    const { error } = await supabase.from("apps").update({ theme: after.theme }).eq("id", appId);
    if (error) return error.message;
  }
  return null;
}
