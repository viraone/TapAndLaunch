import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { AppCard } from "@/components/dashboard/AppCard";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";

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

  const rootDomain = getRootDomain();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your apps</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {apps?.length ? `${apps.length} app${apps.length === 1 ? "" : "s"} in this organization.` : "Build your first app in minutes."}
          </p>
        </div>
        <Link
          href="/dashboard/apps/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> New app
        </Link>
      </div>

      {!apps || apps.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-pink-400 text-neutral-950 shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight">No apps yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create one, drop in a few blocks, and publish it to its own subdomain.
          </p>
          <Link
            href="/dashboard/apps/new"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Create your first app
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} rootDomain={rootDomain} />
          ))}
        </div>
      )}
    </main>
  );
}
