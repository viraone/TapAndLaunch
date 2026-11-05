import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ScheduleSeriesRow,
  ScheduleVisitInsert,
} from "@/types/database";
import { addDays, localDateOf, occurrencesBetween } from "./recurrence";

/** How far ahead a repeat rule keeps its visits filled in. */
export const HORIZON_DAYS = 90;

/** Pure: the rows a repeat rule should have between two local dates. */
export function visitRowsForSeries(
  series: ScheduleSeriesRow,
  fromDate: string,
  untilDate: string,
  timeZone: string
): ScheduleVisitInsert[] {
  if (!series.active) return [];

  return occurrencesBetween(
    {
      startsOn: series.starts_on,
      startTime: series.start_time,
      intervalWeeks: series.interval_weeks,
      endsOn: series.ends_on,
    },
    fromDate,
    untilDate,
    timeZone
  ).map((startsAt) => ({
    app_id: series.app_id,
    customer_id: series.customer_id,
    series_id: series.id,
    starts_at: startsAt.toISOString(),
    occurrence_on: localDateOf(startsAt, timeZone),
    duration_minutes: series.duration_minutes,
    service: series.service,
    notes: series.notes,
    status: "scheduled" as const,
  }));
}

/**
 * Makes sure every active repeat rule of the app has its visits up to
 * HORIZON_DAYS ahead. Safe to call often: the upsert ignores occurrences that
 * already exist (including moved and cancelled visits). Returns how many rows
 * were added.
 */
export async function ensureSeriesVisits(
  supabase: SupabaseClient<Database>,
  appId: string,
  timeZone: string,
  now: Date = new Date()
): Promise<number> {
  const today = localDateOf(now, timeZone);
  const untilDate = addDays(today, HORIZON_DAYS);

  const { data: seriesRows, error: seriesError } = await supabase
    .from("schedule_series")
    .select("*")
    .eq("app_id", appId)
    .eq("active", true);

  if (seriesError) throw new Error(seriesError.message);

  const rows = (seriesRows ?? []).flatMap((series) =>
    visitRowsForSeries(series, today, untilDate, timeZone)
  );
  if (rows.length === 0) return 0;

  const { data: inserted, error: insertError } = await supabase
    .from("schedule_visits")
    .upsert(rows, {
      onConflict: "series_id,occurrence_on",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertError) throw new Error(insertError.message);

  return inserted?.length ?? 0;
}
