import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { decryptSecret } from "@/lib/ai/keys";
import { ProviderError, fastModel, streamText, type AiProvider } from "@/lib/ai/providers";
import { CODE_SYSTEM_PROMPT, userMessage } from "@/lib/code/prompt";
import { applyChanges, applyEdits, parseReply, summarize, validateFiles, type CodeFiles } from "@/lib/code/files";
import { firstBuild, isFreshApp, SlowDown, type Ask } from "@/lib/code/first-build";
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
  const since = new Date();
  since.setHours(since.getHours() - 1);
  // Three independent lookups, run together so the AI can start sooner.
  const [{ data: keyRow }, { count }, current] = await Promise.all([
    admin.from("org_ai_keys").select("provider, encrypted_key, model").eq("organization_id", app.organization_id).maybeSingle(),
    admin.from("ai_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("kind", "code").gte("created_at", since.toISOString()),
    latestVersion(supabase, appId),
  ]);
  if (!keyRow) return Response.json({ error: "Add your AI key first.", needsKey: true }, { status: 400 });
  if ((count ?? 0) >= CODE_HOURLY_LIMIT) return Response.json({ error: `That's ${CODE_HOURLY_LIMIT} builds this hour. Take a short break and try again.` }, { status: 429 });
  if (!current) return Response.json({ error: "This app has no code yet." }, { status: 400 });
  // Counted for the hourly limit. Supabase only sends a query once something waits for it, so it's awaited (about 50ms).
  await admin.from("ai_generations").insert({ user_id: user.id, organization_id: app.organization_id, kind: "code" });

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
        const apiKey = decryptSecret(keyRow.encrypted_key);
        const provider = keyRow.provider as AiProvider;
        // Builds use the provider's small, quick model; if the provider doesn't have it, the model chosen with the key does the job.
        let model = fastModel(provider, keyRow.model);
        const ask: Ask = async (turns, onText = () => {}) => {
          try {
            return await streamText(provider, apiKey, model, CODE_SYSTEM_PROMPT, turns, onText);
          } catch (error) {
            if (error instanceof ProviderError && error.status === 429) throw new SlowDown(error.message);
            if (model === keyRow.model || !(error instanceof ProviderError) || ![400, 404].includes(error.status)) throw error;
            model = keyRow.model;
            return streamText(provider, apiKey, model, CODE_SYSTEM_PROMPT, turns, onText);
          }
        };

        let reply: string;
        let next: CodeFiles;
        let changed: Set<string>;
        if (isFreshApp(current.files)) {
          // A new app: a short plan first, then every section written at the same time.
          const built = await firstBuild({ files: current.files, message: parsed.data.message, history: parsed.data.history, ask, send });
          if ("error" in built) {
            finish({ error: built.error });
            return;
          }
          reply = built.reply;
          if (Object.keys(built.changes).length === 0) {
            finish({ reply, version: current.version, files: null });
            return;
          }
          next = applyChanges(current.files, built.changes);
          changed = new Set(Object.keys(built.changes));
        } else {
          const turns = [...parsed.data.history, { role: "user" as const, content: userMessage(current.files, parsed.data.message) }];
          const full = await ask(turns, send);
          const first = parseReply(full);
          reply = first.reply;
          const { incomplete } = first;
          if (Object.keys(first.changes).length === 0 && first.edits.length === 0) {
            finish({ reply, version: current.version, files: null, note: incomplete.length ? "The answer was cut off before a file finished. Try a smaller request." : undefined });
            return;
          }
          if (incomplete.length) {
            finish({ error: `The AI's answer was cut off while writing ${incomplete[0]}. Nothing was changed. Try a smaller request.` });
            return;
          }
          // Whole files and deletions first, then the small edits on top of them.
          next = applyChanges(current.files, first.changes);
          changed = new Set([...Object.keys(first.changes), ...first.edits.map((e) => e.path)]);
          const applied = applyEdits(next, first.edits);
          next = applied.files;
          if (applied.failed.length > 0) {
            // An edit didn't match exactly. Rather than fail, ask for the whole of each file once.
            const paths = [...new Set(applied.failed.map((f) => f.path))];
            const retry = await ask(
              [
                ...turns,
                { role: "assistant", content: full },
                { role: "user", content: `Some of your edits could not be applied (${applied.failed.map((f) => `${f.path}: ${f.reason}`).join("; ")}). Send the COMPLETE new content of these files as <file> blocks, with all the changes you intended, and nothing else: ${paths.join(", ")}.` },
              ],
              send
            );
            const second = parseReply(retry);
            const missing = paths.filter((path) => typeof second.changes[path] !== "string");
            if (second.incomplete.length > 0 || missing.length > 0) {
              finish({ error: "The AI couldn't apply that change cleanly. Nothing was changed. Try again, or ask for it in a different way." });
              return;
            }
            // The failed files are replaced whole; every other edit already applied stays.
            next = applyChanges(next, Object.fromEntries(paths.map((path) => [path, second.changes[path] as string])));
          }
        }
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
        finish({ reply, version: saved.version, files: next, changed: [...changed] });
      } catch (error) {
        const message = error instanceof SlowDown ? "Your AI provider says you're sending requests too fast. Wait a minute and try again." : error instanceof ProviderError ? error.message : "The AI stopped before it finished. Try again.";
        finish({ error: message });
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
