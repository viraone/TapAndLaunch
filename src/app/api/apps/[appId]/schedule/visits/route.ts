import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { addDays, localDateOf, zonedTimeToUtc } from "@/lib/schedule/recurrence";
import { parseVisitInput } from "@/lib/schedule/validate";
import { HORIZON_DAYS, visitRowsForSeries } from "@/lib/schedule/generate";

type VisitRow = Database["public"]["Tables"]["schedule_visits"]["Row"];

/** Adds a one-off visit, or a repeat rule with its first visits. */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = parseVisitInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;

  const { data: settings, error: settingsError } = await supabase
    .from("schedule_settings")
    .select("*")
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

  const { data: customer, error: customerError } = await supabase
    .from("schedule_customers")
    .select("id")
    .eq("id", input.customer_id)
    .eq("app_id", appId)
    .maybeSingle();
  if (customerError) {
    return Response.json({ error: customerError.message }, { status: 400 });
  }
  if (!customer) {
    return Response.json({ error: "Pick a customer." }, { status: 400 });
  }

  if (input.repeat_every_weeks === null) {
    const startsAt = zonedTimeToUtc(
      input.date,
      input.time,
      settings.time_zone
    ).toISOString();

    const { data: visit, error } = await supabase
      .from("schedule_visits")
      .insert({
        app_id: appId,
        customer_id: input.customer_id,
        starts_at: startsAt,
        duration_minutes: input.duration_minutes,
        service: input.service,
        notes: input.notes,
      })
      .select("*")
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ visits: [visit] }, { status: 201 });
  }

  const { data: series, error: seriesError } = await supabase
    .from("schedule_series")
    .insert({
      app_id: appId,
      customer_id: input.customer_id,
      starts_on: input.date,
      start_time: input.time,
      interval_weeks: input.repeat_every_weeks,
      ends_on: input.repeat_until,
      duration_minutes: input.duration_minutes,
      service: input.service,
      notes: input.notes,
    })
    .select("*")
    .single();

  if (seriesError) {
    return Response.json({ error: seriesError.message }, { status: 400 });
  }

  const today = localDateOf(new Date(), settings.time_zone);
  const untilDate = addDays(input.date > today ? input.date : today, HORIZON_DAYS);
  const rows = visitRowsForSeries(series, input.date, untilDate, settings.time_zone);

  let visits: VisitRow[] = [];
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("schedule_visits")
      .insert(rows)
      .select("*");

    if (error) {
      // Do not leave a repeat rule behind when its visits could not be saved.
      await supabase
        .from("schedule_series")
        .delete()
        .eq("id", series.id)
        .eq("app_id", appId);
      return Response.json({ error: error.message }, { status: 400 });
    }

    visits = data ?? [];
  }

  visits.sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return Response.json({ series, visits }, { status: 201 });
}
