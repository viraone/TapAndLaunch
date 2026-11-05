import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { getConnectionStatus } from "@/lib/integrations/google/connection";

/**
 * Turns automatic reminders on or off for the app. On requires a saved reminder, Scheduling on and a Gmail
 * connection that can still send; off always works, even after the connection is gone.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await isAppEditor(supabase, appId))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const enabled =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).enabled
      : undefined;

  if (typeof enabled !== "boolean") {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  if (enabled) {
    const { data: reminder } = await supabase
      .from("reminder_settings")
      .select("app_id")
      .eq("app_id", appId)
      .maybeSingle();

    if (!reminder) {
      return Response.json({ error: "Save your reminder first." }, { status: 400 });
    }

    const { data: schedule } = await supabase
      .from("schedule_settings")
      .select("app_id")
      .eq("app_id", appId)
      .maybeSingle();

    if (!schedule) {
      return Response.json(
        { error: "Scheduling isn't turned on for this app yet." },
        { status: 400 }
      );
    }

    const status = await getConnectionStatus(appId);
    if (!status.connected || !status.canSend || status.needsReconnect) {
      return Response.json({ error: "Connect Gmail first." }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("reminder_settings")
    .update({ enabled })
    .eq("app_id", appId);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ enabled });
}
