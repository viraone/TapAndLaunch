import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MembersTable } from "./MembersTable";

type Params = Promise<{ appId: string }>;

export default async function MembersPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  // Never `select("*")` here: RLS lets org members read the row, but
  // `password_hash` living in that row is not something the dashboard
  // should ever serialize to the client, RLS-permitted or not.
  const { data: members } = await supabase
    .from("app_members")
    .select("id, app_id, email, display_name, phone, tier, created_at")
    .eq("app_id", appId)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — members</h1>
        <Link href={`/dashboard/apps/${appId}/builder`} className="text-sm underline">
          Back to builder
        </Link>
      </div>
      <MembersTable appId={appId} members={members ?? []} />
    </main>
  );
}
