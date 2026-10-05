import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { restoreDaysLeft } from "@/lib/apps/deletion";

/**
 * Brings back an app deleted in the last 30 days, as a draft (publish it again when ready). Admins of the
 * app's organization only. The app is invisible to the user's own session while deleted, so it is found with
 * the service role and the role is checked against the organization it belongs to.
 */
export async function POST(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: app } = await admin.from("apps").select("id, organization_id, deleted_at").eq("id", appId).not("deleted_at", "is", null).maybeSingle();
  if (!app || !app.deleted_at) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase.from("memberships").select("role").eq("organization_id", app.organization_id).eq("user_id", user.id).maybeSingle();
  if (membership?.role !== "admin") return Response.json({ error: "Only an organization admin can restore an app" }, { status: 403 });

  if (restoreDaysLeft(app.deleted_at, new Date()) === 0) {
    return Response.json({ error: "This app was deleted more than 30 days ago and can't be restored" }, { status: 410 });
  }

  const { error } = await admin.from("apps").update({ deleted_at: null, deleted_by: null }).eq("id", appId);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
