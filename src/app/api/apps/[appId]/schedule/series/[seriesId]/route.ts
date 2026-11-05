import { createClient } from "@/lib/supabase/server";
import { localDateOf } from "@/lib/schedule/recurrence";

/**
 * "Stop repeating": ends the rule today and removes the visits it would still
 * create. Past and done visits stay.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ appId: string; seriesId: string }> }
) {
  const { appId, seriesId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: settings, error: settingsError } = await supabase
    .from("schedule_settings")
    .select("time_zone")
    .eq("app_id", appId)
    .maybeSingle();
  if (settingsError) {
    return Response.json({ error: settingsError.message }, { status: 400 });
  }
  if (!settings) {
    return Response.json(
      { error: "Scheduling isn't turned on for this app yet." },
      { status: 400 }
    );
  }

  const { data: series, error: seriesError } = await supabase
    .from("schedule_series")
    .update({ active: false, ends_on: localDateOf(new Date(), settings.time_zone) })
    .eq("id", seriesId)
    .eq("app_id", appId)
    .select("id")
    .maybeSingle();

  if (seriesError) {
    return Response.json({ error: seriesError.message }, { status: 400 });
  }
  if (!series) {
    return Response.json({ error: "Repeat rule not found." }, { status: 404 });
  }

  const { data: removedRows, error: deleteError } = await supabase
    .from("schedule_visits")
    .delete()
    .eq("series_id", seriesId)
    .eq("app_id", appId)
    .in("status", ["scheduled", "confirmed"])
    .gt("starts_at", new Date().toISOString())
    .select("id");

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 400 });
  }

  return Response.json({ ok: true, removed: removedRows?.length ?? 0 });
}
