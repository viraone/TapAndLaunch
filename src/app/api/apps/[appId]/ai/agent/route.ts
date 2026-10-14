import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { NO_AI_MESSAGE, resolveAsker } from "@/lib/ai/ask";
import { countUsage } from "@/lib/ai/usage";
import { describeSite, loadSite } from "@/lib/ai/site-context";
import { runAgent } from "@/lib/ai/agent";
import { isProviderError } from "@/lib/ai/providers";

const Schema = z.object({ instruction: z.string().trim().min(2).max(1000) });

export const maxDuration = 60;

/**
 * The agent: one request about the whole site. Nothing is saved here. The answer is the site before and after, page
 * by page, and the builder puts the changes on the page with Keep / Undo for each section (and applies the other
 * pages' changes through the same APIs the builder already uses, so every write is the owner's own and undoable).
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
  if (!parsed.success) return Response.json({ error: "Say what should change (up to 1,000 characters)." }, { status: 400 });

  const site = await loadSite(supabase, appId);
  if (!site) return Response.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const asker = await resolveAsker(admin, site.app.organization_id);
  if (!asker) return Response.json({ error: NO_AI_MESSAGE, needsKey: true }, { status: 400 });
  const over = await countUsage(admin, { userId: user.id, organizationId: site.app.organization_id, kind: "agent", details: { app_id: appId, source: asker.source } });
  if (over) return Response.json({ error: over }, { status: 429 });

  try {
    const run = await runAgent({ draft: site.draft, site: describeSite(site), instruction: parsed.data.instruction, ask: asker.ask });
    if ("error" in run) return Response.json({ error: run.error }, { status: 502 });
    return Response.json({ reply: run.reply, before: run.before, after: run.after, applied: run.applied, skipped: run.skipped });
  } catch (error) {
    if (isProviderError(error)) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ error: error instanceof Error && /abort|timeout/i.test(error.message) ? "The AI didn't answer in time. Try a smaller request." : "The AI couldn't answer. Try again." }, { status: 504 });
  }
}
