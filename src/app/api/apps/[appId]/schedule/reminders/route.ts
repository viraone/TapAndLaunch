import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { parseReminderSettings } from "@/lib/reminders/validate";

/** Saves the app's reminder email. RLS also enforces that the person edits the app's organization. */
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

  const parsed = parseReminderSettings(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
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

  // `enabled` is left alone: phase 5 owns that switch, and an upsert on app_id
  // only writes the columns given here.
  const { data: settings, error } = await supabase
    .from("reminder_settings")
    .upsert(
      { app_id: appId, ...parsed.value },
      { onConflict: "app_id" }
    )
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ settings });
}
