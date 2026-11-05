import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TurnOnScheduling } from "../schedule/TurnOnScheduling";
import { CustomersManager } from "./CustomersManager";

type Params = Promise<{ appId: string }>;

export default async function CustomersPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const { data: settings } = await supabase
    .from("schedule_settings")
    .select("app_id")
    .eq("app_id", appId)
    .maybeSingle();

  const { data: customers } = settings
    ? await supabase
        .from("schedule_customers")
        .select("*")
        .eq("app_id", appId)
        .order("name", { ascending: true })
    : { data: null };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{app.name} — customers</h1>
        <Link href={`/dashboard/apps/${appId}`} className="text-sm underline">
          Back to app
        </Link>
      </div>

      {settings ? (
        <CustomersManager appId={appId} initialCustomers={customers ?? []} />
      ) : (
        <TurnOnScheduling appId={appId} />
      )}
    </main>
  );
}
