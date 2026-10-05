import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { decryptSecret } from "@/lib/ai/keys";
import { ProviderError, streamText, type AiProvider } from "@/lib/ai/providers";
import { CODE_SYSTEM_PROMPT, userMessage } from "@/lib/code/prompt";
import { applyChanges, parseReply, summarize, validateFiles } from "@/lib/code/files";
import { latestVersion, saveVersion } from "@/lib/code/store";
import { RESULT_MARK } from "@/lib/code/protocol";

/** Code builds are heavier than block edits, so they have their own hourly limit per person. */
const CODE_HOURLY_LIMIT = 30;

const Schema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) })).max(8).default([]),
});

/** A long answer can take a few minutes; it streams so the owner sees it being written. */
export const maxDuration = 300;

/**
 * "BYOB" code mode. The owner's message and the app's current files go to the owner's own AI key; the answer streams back
 * to the browser as it is written. When it finishes, the files are checked and saved as a new version with the owner's
 * own session (so the database's rules apply), and a final line tells the browser the result.
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
  if (!parsed.success) return Response.json({ error: "Type a message (up to 4,000 characters)" }, { status: 400 });

  const { data: app } = await supabase.from("apps").select("id, organization_id, kind").eq("id", appId).maybeSingle();
  if (!app) return Response.json({ error: "Not found" }, { status: 404 });
  if (app.kind !== "code") return Response.json({ error: "This app isn't an AI code app" }, { status: 400 });

  const admin = createAdminClient();
  const { data: keyRow } = await admin.from("org_ai_keys").select("provider, encrypted_key, model").eq("organization_id", app.organization_id).maybeSingle();
  if (!keyRow) return Response.json({ error: "Add your AI key first.", needsKey: true }, { status: 400 });

  const since = new Date();
  since.setHours(since.getHours() - 1);
  const { count } = await admin.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", "code").gte("created_at", since.toISOString());
  if ((count ?? 0) >= CODE_HOURLY_LIMIT) return Response.json({ error: `That's ${CODE_HOURLY_LIMIT} builds this hour. Take a short break and try again.` }, { status: 429 });
  await admin.from("ai_generations").insert({ user_id: user.id, organization_id: app.organization_id, kind: "code" });

  const current = await latestVersion(supabase, appId);
  if (!current) return Response.json({ error: "This app has no code yet." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // the browser went away; the build carries on and still saves
        }
      };
      const finish = (result: Record<string, unknown>) => {
        send(`${RESULT_MARK}${JSON.stringify(result)}`);
        try {
          controller.close();
        } catch {}
      };
      try {
        const full = await streamText(
          keyRow.provider as AiProvider,
          decryptSecret(keyRow.encrypted_key),
          keyRow.model,
          CODE_SYSTEM_PROMPT,
          [...parsed.data.history, { role: "user", content: userMessage(current.files, parsed.data.message) }],
          send
        );
        const { reply, changes, incomplete } = parseReply(full);
        if (Object.keys(changes).length === 0) {
          finish({ reply, version: current.version, files: null, note: incomplete.length ? "The answer was cut off before a file finished. Try a smaller request." : undefined });
          return;
        }
        if (incomplete.length) {
          finish({ error: `The AI's answer was cut off while writing ${incomplete[0]}. Nothing was changed. Try a smaller request.` });
          return;
        }
        const next = applyChanges(current.files, changes);
        const problem = validateFiles(next);
        if (problem) {
          finish({ error: `${problem} Nothing was changed.` });
          return;
        }
        const saved = await saveVersion(supabase, { appId, files: next, prompt: parsed.data.message, summary: summarize(parsed.data.message), userId: user.id });
        if ("error" in saved) {
          finish({ error: saved.error });
          return;
        }
        finish({ reply, version: saved.version, files: next, changed: Object.keys(changes) });
      } catch (error) {
        finish({ error: error instanceof ProviderError ? error.message : "The AI stopped before it finished. Try again." });
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
