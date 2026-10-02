import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { MapsToggle } from "./MapsToggle";

export const dynamic = "force-dynamic";

/** Platform admins only: every customer organization, and who may use Google Maps features. */
export default async function AdminPage() {
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) notFound();

  const admin = createAdminClient();
  const [{ data: orgs }, { data: memberships }, { data: apps }, usersResult] = await Promise.all([
    admin.from("organizations").select("id, name, slug, maps_enabled, created_at").order("created_at", { ascending: false }),
    admin.from("memberships").select("organization_id, user_id, role"),
    admin.from("apps").select("organization_id, status"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
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
      </div>
    </main>
  );
}
