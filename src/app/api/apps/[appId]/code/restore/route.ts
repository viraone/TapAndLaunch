import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { saveVersion } from "@/lib/code/store";
import type { CodeFiles } from "@/lib/code/files";

const Schema = z.object({ version: z.number().int().min(1) });

/** Goes back to an earlier version by saving a copy of it as the newest one, so nothing is ever lost. */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "You can't edit this app" }, { status: 403 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose a version" }, { status: 400 });

  const { data: old } = await supabase.from("app_code_versions").select("files").eq("app_id", appId).eq("version", parsed.data.version).maybeSingle();
  if (!old) return Response.json({ error: "That version doesn't exist" }, { status: 404 });
  const saved = await saveVersion(supabase, { appId, files: old.files as CodeFiles, prompt: null, summary: `Restored version ${parsed.data.version}`, userId: user.id });
  if ("error" in saved) return Response.json({ error: saved.error }, { status: 500 });
  return Response.json({ version: saved.version, files: old.files });
}
