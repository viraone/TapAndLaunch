import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GasStationsTable } from "./GasStationsTable";

type Params = Promise<{ appId: string }>;

export default async function GasStationsPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const { data: stations } = await supabase
    .from("gas_stations")
    .select("*")
    .eq("app_id", appId)
    .order("updated_at", { ascending: false })
    .limit(200);

  const { data: budget } = await supabase
    .from("gas_fetch_budget")
    .select("day, calls")
    .eq("app_id", appId)
    .order("day", { ascending: false })
    .limit(7);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — gas stations</h1>
        <Link href={`/dashboard/apps/${appId}/builder`} className="text-sm underline">
          Back to builder
        </Link>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Stations appear here automatically as viewers open the app in new areas (Google Places,
        cached per area for an hour). Google calls, last 7 days:{" "}
        {budget && budget.length > 0 ? budget.map((b) => `${b.day}: ${b.calls}`).join(" · ") : "none yet"}.
      </p>
      <GasStationsTable appId={appId} stations={stations ?? []} />
    </main>
  );
}
