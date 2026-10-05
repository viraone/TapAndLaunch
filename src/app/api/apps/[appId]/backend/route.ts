import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { latestVersion, saveVersion } from "@/lib/code/store";
import { checkBackendInput, projectRef, sqlEditorUrl, sqlFiles, sqlHash, SUPABASE_PATH, supabaseFile, verifyBackend } from "@/lib/code/backend";

/**
 * An AI-written app's own database (the owner's Supabase project): GET its status and setup files, PUT to connect,
 * PATCH to mark a setup file as run, DELETE to disconnect. Only the project's public key is stored.
 */
export async function GET(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const [{ data: backend }, current] = await Promise.all([supabase.from("app_backends").select("url, applied_sql").eq("app_id", appId).maybeSingle(), latestVersion(supabase, appId)]);
  return Response.json({ backend: backend ? describe(backend.url) : null, sql: sqlFiles(current?.files ?? {}, backend?.applied_sql ?? {}).map(({ path, sql, ran, changed }) => ({ path, sql, ran, changed })) });
}

const Connect = z.object({ url: z.string().max(300), key: z.string().max(1000) });

export async function PUT(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "You can't edit this app" }, { status: 403 });
  const parsed = Connect.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Paste the Project URL and the public key." }, { status: 400 });

  const input = checkBackendInput(parsed.data.url, parsed.data.key);
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });
  const check = await verifyBackend(input);
  if ("error" in check) return Response.json({ error: check.error }, { status: 400 });

  const { data: app } = await supabase.from("apps").select("kind").eq("id", appId).maybeSingle();
  if (app?.kind !== "code") return Response.json({ error: "Only AI-built apps can connect a database." }, { status: 400 });
  const { error } = await supabase.from("app_backends").upsert({ app_id: appId, url: input.url, anon_key: input.anonKey, connected_by: user.id, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  // The app gets the ready-made client as a new version, so it can be undone like any other change.
  const current = await latestVersion(supabase, appId);
  const files = { ...(current?.files ?? {}), [SUPABASE_PATH]: supabaseFile(input) };
  const saved = await saveVersion(supabase, { appId, files, prompt: null, summary: "Connected a database", userId: user.id });
  if ("error" in saved) return Response.json({ error: saved.error }, { status: 400 });
  return Response.json({ backend: describe(input.url), confirmEmail: check.confirmEmail, version: saved.version, files });
}

const Mark = z.object({ path: z.string().max(100), ran: z.boolean() });

export async function PATCH(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "You can't edit this app" }, { status: 403 });
  const parsed = Mark.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const [{ data: backend }, current] = await Promise.all([supabase.from("app_backends").select("applied_sql").eq("app_id", appId).maybeSingle(), latestVersion(supabase, appId)]);
  if (!backend) return Response.json({ error: "Connect a database first." }, { status: 400 });
  const sql = current?.files[parsed.data.path];
  if (sql === undefined) return Response.json({ error: "That setup file isn't in the app." }, { status: 404 });
  const applied = { ...backend.applied_sql };
  if (parsed.data.ran) applied[parsed.data.path] = sqlHash(sql);
  else delete applied[parsed.data.path];
  const { error } = await supabase.from("app_backends").update({ applied_sql: applied, updated_at: new Date().toISOString() }).eq("app_id", appId);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ sql: sqlFiles(current?.files ?? {}, applied).map(({ path, sql: text, ran, changed }) => ({ path, sql: text, ran, changed })) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "You can't edit this app" }, { status: 403 });
  const { error } = await supabase.from("app_backends").delete().eq("app_id", appId);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}

function describe(url: string) {
  return { url, ref: projectRef(url), sqlEditor: sqlEditorUrl(url) };
}
