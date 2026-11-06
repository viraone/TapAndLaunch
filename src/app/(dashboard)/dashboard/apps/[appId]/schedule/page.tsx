import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureSeriesVisits } from "@/lib/schedule/generate";
import { addDays, localDateOf, zonedTimeToUtc } from "@/lib/schedule/recurrence";
import { SchedulingShell } from "../SchedulingShell";
import { ScheduleManager } from "./ScheduleManager";
import { TurnOnScheduling } from "./TurnOnScheduling";

type Params = Promise<{ appId: string }>;

export default async function SchedulePage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const { data: settings } = await supabase
    .from("schedule_settings")
    .select("*")
    .eq("app_id", appId)
    .maybeSingle();

  if (!settings) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{app.name} — schedule</h1>
          <Link href={`/dashboard/apps/${appId}`} className="text-sm underline">
            Back to app
          </Link>
        </div>
        <TurnOnScheduling appId={appId} />
      </main>
    );
  }

  const { data: customers } = await supabase
    .from("schedule_customers")
    .select("id, name")
    .eq("app_id", appId)
    .order("name", { ascending: true });

  const now = new Date();
  try {
    // Top up the repeat rules before reading them. A failure here should not
    // hide the visits that are already saved.
    await ensureSeriesVisits(supabase, appId, settings.time_zone, now);
  } catch {
    // The list below still shows what is saved.
  }

  const today = localDateOf(now, settings.time_zone);
  const cutoff = zonedTimeToUtc(
    addDays(today, -14),
    "00:00",
    settings.time_zone
  ).toISOString();

  const [{ data: visits }, { data: activeSeries }] = await Promise.all([
    supabase
      .from("schedule_visits")
      .select("*")
      .eq("app_id", appId)
      .gte("starts_at", cutoff)
      .order("starts_at", { ascending: true }),
    supabase
      .from("schedule_series")
      .select("id")
      .eq("app_id", appId)
      .eq("active", true),
  ]);

  const screen = (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{app.name} — schedule</h1>
        <Link href={`/dashboard/apps/${appId}`} className="text-sm underline">
          Back to app
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Times are shown in {settings.time_zone}.
      </p>

      {/* The key remounts the list with the fresh server data after
          router.refresh(), e.g. once "Stop repeating" has run. */}
      <ScheduleManager
        key={now.toISOString()}
        appId={appId}
        timeZone={settings.time_zone}
        defaultDurationMinutes={settings.default_duration_minutes}
        customers={customers ?? []}
        initialVisits={visits ?? []}
        initialActiveSeriesIds={(activeSeries ?? []).map((series) => series.id)}
        nowIso={now.toISOString()}
      />
    </main>
  );

  return (
    <SchedulingShell appId={appId} active="schedule">
      {screen}
    </SchedulingShell>
  );
}
