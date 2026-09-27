import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countsByDay, countsByPage } from "@/lib/analytics/aggregate";
import { StatTile } from "@/components/dashboard/charts/StatTile";
import { LineAreaChart } from "@/components/dashboard/charts/LineAreaChart";
import { BarChart } from "@/components/dashboard/charts/BarChart";
import { cn } from "@/lib/utils";

type Params = Promise<{ appId: string }>;
type SearchParams = Promise<{ range?: string }>;

const RANGE_PRESETS = [7, 30, 90] as const;

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { appId } = await params;
  const { range } = await searchParams;
  const days = RANGE_PRESETS.includes(Number(range) as (typeof RANGE_PRESETS)[number])
    ? Number(range)
    : 30;

  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const { data: pages } = await supabase.from("pages").select("id, name").eq("app_id", appId);

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const { data: events } = await supabase
    .from("analytics_events")
    .select("event_type, page_id, created_at")
    .eq("app_id", appId)
    .gte("created_at", since.toISOString());

  const { count: submissionCount } = await supabase
    .from("form_submissions")
    .select("*", { count: "exact", head: true })
    .eq("app_id", appId)
    .gte("created_at", since.toISOString());

  const allEvents = events ?? [];
  const views = allEvents.filter((e) => e.event_type === "view");
  const installs = allEvents.filter((e) => e.event_type === "install");

  const viewsByDay = countsByDay(
    views.map((e) => e.created_at),
    days
  );
  const viewsByPage = countsByPage(views, pages ?? []).slice(0, 8);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — analytics</h1>
        <Link href={`/dashboard/apps/${appId}/builder`} className="text-sm underline">
          Back to builder
        </Link>
      </div>

      {/* One row, above the charts — every chart below is scoped to the
          same range, so the numbers always agree with each other. */}
      <div className="mb-6 flex gap-1">
        {RANGE_PRESETS.map((preset) => (
          <Link
            key={preset}
            href={`/dashboard/apps/${appId}/analytics?range=${preset}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm",
              preset === days ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            Last {preset} days
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatTile label="Views" value={views.length} />
        <StatTile label="Installs" value={installs.length} />
        <StatTile label="Form submissions" value={submissionCount ?? 0} />
      </div>

      <section className="mb-6 rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Views over time</h2>
        <LineAreaChart data={viewsByDay} />
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Most viewed pages</h2>
        <BarChart data={viewsByPage} />
      </section>
    </main>
  );
}
