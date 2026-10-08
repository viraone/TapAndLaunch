import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { STARTER_TEMPLATES } from "@/lib/apps/templates";
import { TEMPLATE_ICONS } from "@/components/dashboard/templateIcons";
import { AppCard, type DailyViews } from "@/components/dashboard/AppCard";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { getChecklists } from "@/lib/apps/signals";
import { createAdminClient } from "@/lib/supabase/admin";

const DAYS = 7;

/** Shown on the "New app" card so people can see templates are behind it. */
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

  // Deleted apps and their Restore buttons live in Settings, not here: this page is the apps someone is working on.
  const rootDomain = getRootDomain();
  const [{ perApp, views, installs }, checklists] = await Promise.all([
    weeklyActivity(supabase, (apps ?? []).map((a) => a.id)),
    getChecklists(supabase, apps ?? []),
  ]);
  const live = (apps ?? []).filter((a) => a.status === "published").length;

  return (
    <main className="flex-1 bg-neutral-100/70">
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              {/* The organization's name only matters to someone who belongs to more than one. */}
              {orgName && memberships.length > 1 && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">{orgName}</p>}
              <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Your apps</h1>
              <p className="mt-2 max-w-md text-sm text-neutral-400">
                {apps?.length
                  ? "Everything you've launched, with how it did this week."
                  : "Build your first app in minutes and publish it to its own address."}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/apps/new"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-neutral-950 shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_10px_30px_-10px_rgba(129,140,248,0.8)] transition hover:bg-indigo-50"
                >
                  <Plus className="h-4 w-4" /> New app
                </Link>
              </div>
              <p className="text-xs text-neutral-400">Pick a template to start from</p>
            </div>
          </div>

          {!!apps?.length && (
            // "Added to home screens" (an "install", in app-store words) only shows once it has happened: a zero in the
            // headline row read as bad news.
            <dl className={`mt-8 grid max-w-2xl gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 ${installs > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
              <Stat label="Apps live" value={`${live}`} sub={`of ${apps.length}`} />
              <Stat label="Views" value={views.toLocaleString()} sub="this week" />
              {installs > 0 && <Stat label="Added to home screens" value={installs.toLocaleString()} sub="this week" />}
            </dl>
          )}
        </div>
      </section>

      <div className="relative mx-auto -mt-14 w-full max-w-6xl px-6 pb-16">
        {!apps || apps.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="h-6 w-6" />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight">No apps yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
              Create one, drop in a few blocks, and publish it to its own subdomain.
            </p>
            <Link
              href="/dashboard/apps/new"
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" /> Create your first app
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <AppCard key={app.id} app={app} rootDomain={rootDomain} views={perApp.get(app.id) ?? new Array(DAYS).fill(0)} checklist={checklists.get(app.id)} canDelete={isAdmin} />
            ))}
            <Link
              href="/dashboard/apps/new"
              className="group flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-neutral-300 text-neutral-500 transition hover:border-neutral-950 hover:bg-white hover:text-neutral-950"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition group-hover:bg-neutral-950 group-hover:text-white">
                <Plus className="h-6 w-6" />
              </span>
              <span className="text-sm font-semibold">New app</span>
              <span className="-mt-2 text-xs text-neutral-500">From a template or a sentence</span>
              <span className="mt-1 flex -space-x-2" aria-hidden>
                {FEATURED.map((t) => {
                  const Icon = TEMPLATE_ICONS[t.icon];
                  return (
                    <span key={t.id} className="grid h-9 w-9 place-items-center rounded-full text-white ring-2 ring-neutral-100 transition group-hover:ring-white" style={{ background: t.color }}>
                      <Icon className="h-4 w-4" />
                    </span>
                  );
                })}
              </span>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-neutral-950/60 px-4 py-4 backdrop-blur sm:px-5">
      <dt className="text-xs font-medium text-neutral-400">{label}</dt>
      <dd className="mt-1 flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        <span className="text-xs text-neutral-500">{sub}</span>
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
