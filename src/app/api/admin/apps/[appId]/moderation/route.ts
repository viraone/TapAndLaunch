import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";

const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("takedown"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("dismiss") }),
]);

/**
 * Platform admins only. Take an app down (it stops being served everywhere and its owner can't publish it again),
 * restore it, or dismiss its open reports. Taking down or restoring also closes the open reports.
 */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isPlatformAdmin(supabase))) return Response.json({ error: "Not allowed" }, { status: 403 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Say why the app is being taken down." }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  if (parsed.data.action !== "dismiss") {
    const update = parsed.data.action === "takedown" ? { suspended_at: now, suspended_reason: parsed.data.reason } : { suspended_at: null, suspended_reason: null };
    const { data, error } = await admin.from("apps").update(update).eq("id", appId).select("id, suspended_at").maybeSingle();
    if (error || !data) return Response.json({ error: error?.message ?? "App not found" }, { status: 400 });
  }
  await admin.from("app_reports").update({ resolved_at: now }).eq("app_id", appId).is("resolved_at", null);
  return Response.json({ ok: true });
}
