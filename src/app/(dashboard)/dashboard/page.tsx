import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppCard } from "@/components/dashboard/AppCard";
import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: memberships } = await supabase.from("memberships").select("organization_id").limit(1);
  const organizationId = memberships?.[0]?.organization_id;
  if (!organizationId) redirect("/onboarding");

  const { data: apps } = await supabase
    .from("apps")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const rootDomain = getRootDomain();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your apps</h1>
        <Button render={<Link href="/dashboard/apps/new">New app</Link>} />
      </div>

      {!apps || apps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No apps yet.{" "}
          <Link href="/dashboard/apps/new" className="underline">
            Create your first one
          </Link>
          .
        </p>
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
