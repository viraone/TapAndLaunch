import { createClient } from "@/lib/supabase/server";
import { latestVersion, listVersions } from "@/lib/code/store";

/** The newest files and the version list of a code app, for members of its organization (row-level rules decide who sees what). */
export async function GET(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const { data: app } = await supabase.from("apps").select("id, kind, status, code_published_version").eq("id", appId).maybeSingle();
  if (!app || app.kind !== "code") return Response.json({ error: "Not found" }, { status: 404 });
  const [latest, versions] = await Promise.all([latestVersion(supabase, appId), listVersions(supabase, appId)]);
  return Response.json({ version: latest?.version ?? 0, files: latest?.files ?? {}, versions, publishedVersion: app.code_published_version, status: app.status });
}
