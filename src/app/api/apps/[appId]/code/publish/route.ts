import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { latestVersion } from "@/lib/code/store";

const Schema = z.object({ status: z.enum(["published", "draft"]) });

/** Publishing a code app puts its newest version live (a snapshot: later edits stay private until published again). */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "You can't edit this app" }, { status: 403 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const { data: app } = await supabase.from("apps").select("id, kind").eq("id", appId).maybeSingle();
  if (!app || app.kind !== "code") return Response.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.status === "draft") {
    const { data, error } = await supabase.from("apps").update({ status: "draft" }).eq("id", appId).select("*").single();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ app: data });
  }
  const latest = await latestVersion(supabase, appId);
  if (!latest) return Response.json({ error: "There's nothing to publish yet" }, { status: 400 });
  const { data, error } = await supabase.from("apps").update({ status: "published", code_published_version: latest.version }).eq("id", appId).select("*").single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ app: data, version: latest.version });
}
