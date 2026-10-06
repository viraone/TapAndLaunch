import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { MapsToggle } from "./MapsToggle";
import { ModerationActions } from "./Moderation";
import { appLiveUrl } from "@/lib/apps/share";
import { getRootDomain } from "@/lib/tenant";
import { REPORT_REASON_LABELS } from "@/lib/moderation/labels";

export const dynamic = "force-dynamic";

/** Platform admins only: every customer organization, and who may use Google Maps features. */
export default async function AdminPage() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();

  const admin = createAdminClient();
  const [{ data: orgs }, { data: memberships }, { data: apps }, usersResult, { data: codeApps }, { data: reports }] = await Promise.all([
    admin.from("organizations").select("id, name, slug, maps_enabled, created_at").order("created_at", { ascending: false }),
    admin.from("memberships").select("organization_id, user_id, role"),
    admin.from("apps").select("organization_id, status").is("deleted_at", null),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("apps").select("id, name, slug, status, organization_id, custom_domain, custom_domain_status, kind, suspended_at, suspended_reason, created_at").eq("kind", "code").is("deleted_at", null),
    admin.from("app_reports").select("app_id, reason, details, created_at").is("resolved_at", null).order("created_at", { ascending: false }),
  ]);
  // AI-written apps, the ones with open reports first: what can be taken down.
  const orgName = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const openBy = new Map<string, NonNullable<typeof reports>>();
  for (const r of reports ?? []) openBy.set(r.app_id, [...(openBy.get(r.app_id) ?? []), r]);
  const moderated = [...(codeApps ?? [])].sort((a, b) => (openBy.get(b.id)?.length ?? 0) - (openBy.get(a.id)?.length ?? 0) || b.created_at.localeCompare(a.created_at));
  const emailById = new Map((usersResult.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const ownerEmail = (orgId: string) => {
    const m = (memberships ?? []).find((x) => x.organization_id === orgId && x.role === "admin");
    return m ? emailById.get(m.user_id) || "—" : "—";
  };
  const appCounts = (orgId: string) => {
    const mine = (apps ?? []).filter((a) => a.organization_id === orgId);
    return { total: mine.length, live: mine.filter((a) => a.status === "published").length };
  };
  const rows = orgs ?? [];
  const withMaps = rows.filter((o) => o.maps_enabled).length;
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <main className="flex-1 bg-neutral-100/70">
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Super admin</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Customers</h1>
          <p className="mt-2 max-w-xl text-sm text-neutral-400">
            Everyone who has signed up. Live food and Gas prices use Google Maps, which costs money per visitor, so they stay off until you switch them on.
          </p>
          <dl className="mt-8 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
            <div className="bg-neutral-950/60 px-5 py-4">
              <dt className="text-xs font-medium text-neutral-400">Organizations</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{rows.length}</dd>
            </div>
            <div className="bg-neutral-950/60 px-5 py-4">
              <dt className="text-xs font-medium text-neutral-400">With Google Maps</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{withMaps}</dd>
            </div>
          </dl>
          <p className="mt-6 flex flex-wrap gap-2">
            <Link href="/dashboard/admin/tapandlaunch" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-neutral-950 transition hover:bg-indigo-50">
              Daily board (to-do) →
            </Link>
            <Link href="/dashboard/admin/fitnessnav" className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15">
              FitnessNav daily board →
            </Link>
          </p>
        </div>
      </section>

      <div className="relative mx-auto -mt-10 w-full max-w-6xl px-6 pb-16">
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
          <ul className="divide-y divide-neutral-100">
            {rows.map((o) => {
              const c = appCounts(o.id);
              return (
                <li key={o.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate font-semibold tracking-tight">{o.name}</p>
                    <p className="truncate text-sm text-neutral-500">{ownerEmail(o.id)}</p>
                  </div>
                  <p className="w-28 text-sm tabular-nums text-neutral-500">
                    {c.total} app{c.total === 1 ? "" : "s"}
                    {c.live > 0 && <span className="text-emerald-600"> · {c.live} live</span>}
                  </p>
                  <p className="w-28 text-sm text-neutral-500">{fmt.format(new Date(o.created_at))}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-neutral-700">Google Maps</span>
                    <MapsToggle organizationId={o.id} enabled={o.maps_enabled} name={o.name} />
                  </div>
                </li>
              );
            })}
            {!rows.length && <li className="px-6 py-10 text-center text-sm text-neutral-500">No organizations yet.</li>}
          </ul>
        </div>

        <h2 id="reports" className="mt-12 scroll-mt-24 text-2xl font-semibold tracking-tight">AI apps and reports</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Apps written by customers&apos; own AI. Anyone can report one from the app itself. Taking one down stops it being shown anywhere, and its owner can&apos;t publish it again until you restore it.
        </p>
        <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5">
          <ul className="divide-y divide-neutral-100">
            {moderated.map((a) => {
              const open = openBy.get(a.id) ?? [];
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="truncate font-semibold tracking-tight">
                      {a.name}{" "}
                      {a.suspended_at ? (
                        <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Taken down</span>
                      ) : a.status === "published" ? (
                        <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Live</span>
                      ) : (
                        <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">Draft</span>
                      )}
                    </p>
                    <p className="truncate text-sm text-neutral-500">
                      {orgName.get(a.organization_id) ?? "—"} ·{" "}
                      <a href={appLiveUrl(a, getRootDomain())} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                        {appLiveUrl(a, getRootDomain()).replace(/^https?:\/\//, "")}
                      </a>
                    </p>
                    {a.suspended_reason && <p className="mt-1 text-sm text-red-700">Reason: {a.suspended_reason}</p>}
                    {open.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {open.slice(0, 3).map((r, i) => (
                          <li key={i} className="text-sm text-amber-800">
                            <span className="font-semibold">{REPORT_REASON_LABELS[r.reason]}</span>
                            {r.details ? ` — ${r.details.slice(0, 140)}` : ""}
                          </li>
                        ))}
                        {open.length > 3 && <li className="text-sm text-amber-800">and {open.length - 3} more</li>}
                      </ul>
                    )}
                  </div>
                  <p className="w-28 text-sm tabular-nums text-neutral-500">
                    {open.length > 0 ? <span className="font-semibold text-amber-700">{open.length} report{open.length === 1 ? "" : "s"}</span> : "No reports"}
                  </p>
                  <ModerationActions appId={a.id} name={a.name} suspended={!!a.suspended_at} openReports={open.length} />
                </li>
              );
            })}
            {!moderated.length && <li className="px-6 py-10 text-center text-sm text-neutral-500">No AI apps yet.</li>}
          </ul>
        </div>
      </div>
    </main>
  );
}
