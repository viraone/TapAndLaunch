import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { STARTER_TEMPLATES } from "@/lib/apps/templates";
import { TEMPLATE_ICONS } from "@/components/dashboard/templateIcons";
import { AppCard, type DailyViews, type SchedulingCardStats } from "@/components/dashboard/AppCard";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { getChecklists } from "@/lib/apps/signals";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDayBounds } from "@/lib/schedule/day";
import { localDateOf } from "@/lib/schedule/recurrence";

const DAYS = 7;

/** Beyond this many Scheduling apps the cards still show, but without their visits/customers numbers. */
const SUMMARISED_SCHEDULING_LIMIT = 24;

/** Shown on the "Choose a template" card so people can see templates are behind it. */
const FEATURED = ["fitness", "restaurant", "salon", "store", "community"].flatMap((id) => STARTER_TEMPLATES.filter((t) => t.id === id));

export default async function DashboardPage() {
  const supabase = await createClient();

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  if (!organizationId) redirect("/onboarding");

  const { data: apps } = await supabase
    .from("apps")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const orgName = memberships.find((m) => m.organization_id === organizationId)?.name;
  const role = memberships.find((m) => m.organization_id === organizationId)?.role;
  const isAdmin = role === "admin";

  // Someone who has never made an app skips the empty screen and goes straight to "What are you building?".
  // (An organization whose apps were all deleted still gets the dashboard, so it can restore them.)
  if ((apps?.length ?? 0) === 0 && (role === "admin" || role === "creator")) {
    const { count } = await createAdminClient().from("apps").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
    if ((count ?? 0) === 0) redirect("/dashboard/apps/new?welcome=1");
  }

  // An app with Scheduling on is a visiting business's admin portal, not a website: it gets a different card, and it
  // does not count in the website stats below.
  const schedulingZones = await loadSchedulingZones(supabase, apps ?? []);
  const schedulingStats = await loadSchedulingStats(supabase, apps ?? [], schedulingZones);
  const otherApps = (apps ?? []).filter((a) => !schedulingZones.has(a.id));
  const allScheduling = (apps?.length ?? 0) > 0 && otherApps.length === 0;

  // Deleted apps and their Restore buttons live in Settings, not here: this page is the apps someone is working on.
  const rootDomain = getRootDomain();
  const [{ perApp, views, installs }, checklists] = await Promise.all([
    weeklyActivity(supabase, otherApps.map((a) => a.id)),
    getChecklists(supabase, apps ?? []),
  ]);
  const live = otherApps.filter((a) => a.status === "published").length;

  return (
    <main className="flex-1 bg-white">
      <section className="mx-auto grid w-full max-w-[1400px] gap-8 px-6 pb-10 pt-12 sm:px-10 sm:pt-16 lg:grid-cols-2 lg:items-end lg:gap-16">
        <div className="min-w-0">
          {/* The organization's name only matters to someone who belongs to more than one. */}
          {orgName && memberships.length > 1 && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{orgName}</p>}
          <h1 className="mt-3 text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-7xl">Your apps</h1>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6 lg:justify-end lg:gap-10">
          <p className="max-w-sm text-lg leading-relaxed text-neutral-700">
            {apps?.length
              ? allScheduling
                ? "Your businesses, and what's on today."
                : "Everything you've launched, with how it did this week."
              : "Build your first app in minutes and publish it to its own address."}
          </p>
          <Link
            href="/dashboard/apps/new"
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-neutral-950 px-6 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" /> Choose a template
          </Link>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1400px] px-6 pb-20 sm:px-10">
        {otherApps.length > 0 && (
          // "Added to home screens" (an "install", in app-store words) only shows once it has happened: a zero in the
          // headline row read as bad news. Scheduling apps are admin portals, so they are not counted here.
          <dl className="flex flex-wrap items-baseline gap-x-12 gap-y-4 border-t border-neutral-200 pb-10 pt-6">
            <Stat label="Apps live" value={`${live}`} sub={`of ${otherApps.length}`} />
            <Stat label="Views" value={views.toLocaleString()} sub="this week" />
            {installs > 0 && <Stat label="Added to home screens" value={installs.toLocaleString()} sub="this week" />}
          </dl>
        )}
        {!apps || apps.length === 0 ? (
          <div className="border-t border-neutral-200 py-20 text-center">
            <h2 className="text-3xl font-medium tracking-[-0.03em]">No apps yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-neutral-600">Create one, drop in a few blocks, and publish it to its own subdomain.</p>
            <Link
              href="/dashboard/apps/new"
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-neutral-950 px-6 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" /> Create your first app
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                rootDomain={rootDomain}
                views={perApp.get(app.id) ?? new Array(DAYS).fill(0)}
                checklist={checklists.get(app.id)}
                canDelete={isAdmin}
                scheduling={schedulingStats.get(app.id)}
              />
            ))}
            <Link href="/dashboard/apps/new" className="group flex flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-950">
              <div className="grid aspect-[16/9] w-full place-items-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500 transition group-hover:border-neutral-950 group-hover:bg-white group-hover:text-neutral-950">
                <span className="flex flex-col items-center gap-2">
                  <Plus className="h-7 w-7" />
                  <span className="flex -space-x-2" aria-hidden>
                    {FEATURED.map((t) => {
                      const Icon = TEMPLATE_ICONS[t.icon];
                      return (
                        <span key={t.id} className="grid h-8 w-8 place-items-center rounded-full text-white ring-2 ring-white" style={{ background: t.color }}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                      );
                    })}
                  </span>
                </span>
              </div>
              <p className="mt-3.5 text-[17px] font-medium tracking-tight text-neutral-950">Choose a template</p>
              <p className="mt-1 text-sm text-neutral-500">Pick a template to start from</p>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-2">
        <span className="text-5xl font-medium tabular-nums tracking-[-0.04em]">{value}</span>
        <span className="text-sm text-neutral-500">{sub}</span>
      </dd>
    </div>
  );
}

/** Views per app per day and the week's totals, from analytics_events
 * (readable by org members through RLS). */
async function weeklyActivity(supabase: Awaited<ReturnType<typeof createClient>>, appIds: string[]) {
  const perApp = new Map<string, DailyViews>();
  if (!appIds.length) return { perApp, views: 0, installs: 0 };
  const now = Date.now();
  const since = new Date(now - DAYS * 86_400_000);
  // The database answers at most 1,000 rows per request whatever limit is asked for, which once showed a busy week as
  // exactly "1,000 views". The week is read a page at a time until a page comes back short (up to 50 pages).
  const PAGE = 1000;
  const data: { app_id: string; event_type: string; created_at: string }[] = [];
  for (let from = 0; from < 50 * PAGE; from += PAGE) {
    const { data: page } = await supabase
      .from("analytics_events")
      .select("app_id, event_type, created_at")
      .in("app_id", appIds)
      .in("event_type", ["view", "install"])
      .gte("created_at", since.toISOString())
      .order("created_at")
      .range(from, from + PAGE - 1);
    data.push(...(page ?? []));
    if (!page || page.length < PAGE) break;
  }
  let views = 0;
  let installs = 0;
  for (const e of data) {
    if (e.event_type === "install") {
      installs++;
      continue;
    }
    views++;
    const day = Math.min(DAYS - 1, Math.floor((new Date(e.created_at).getTime() - since.getTime()) / 86_400_000));
    const row = perApp.get(e.app_id) ?? new Array(DAYS).fill(0);
    row[day]++;
    perApp.set(e.app_id, row);
  }
  return { perApp, views, installs };
}

/** The Scheduling apps among these: a blocks app with a `schedule_settings` row, and the zone its visits are in. */
async function loadSchedulingZones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  apps: readonly { id: string; kind: "blocks" | "code" }[],
): Promise<Map<string, string>> {
  const ids = apps.filter((app) => app.kind === "blocks").map((app) => app.id);
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("schedule_settings")
    .select("app_id, time_zone")
    .in("app_id", ids);
  return new Map((data ?? []).map((row) => [row.app_id, row.time_zone]));
}

/**
 * Today's visits and customer count for each Scheduling app, as one head/count query per number. Only the first
 * `SUMMARISED_SCHEDULING_LIMIT` apps are asked about; the rest keep the card without numbers.
 */
async function loadSchedulingStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  apps: readonly { id: string }[],
  timeZones: Map<string, string>,
): Promise<Map<string, SchedulingCardStats>> {
  const stats = new Map<string, SchedulingCardStats>();
  const ids = apps.filter((app) => timeZones.has(app.id)).map((app) => app.id);
  for (const id of ids) stats.set(id, { visitsToday: null, customers: null });

  const now = new Date();
  await Promise.all(
    ids.slice(0, SUMMARISED_SCHEDULING_LIMIT).map(async (appId) => {
      const timeZone = timeZones.get(appId);
      if (!timeZone) return;
      const bounds = localDayBounds(localDateOf(now, timeZone), timeZone);
      const [visits, customers] = await Promise.all([
        supabase
          .from("schedule_visits")
          .select("id", { count: "exact", head: true })
          .eq("app_id", appId)
          .in("status", ["scheduled", "confirmed"])
          .gte("starts_at", bounds.start.toISOString())
          .lt("starts_at", bounds.end.toISOString()),
        supabase
          .from("schedule_customers")
          .select("id", { count: "exact", head: true })
          .eq("app_id", appId),
      ]);
      stats.set(appId, { visitsToday: visits.count ?? 0, customers: customers.count ?? 0 });
    }),
  );
  return stats;
}
