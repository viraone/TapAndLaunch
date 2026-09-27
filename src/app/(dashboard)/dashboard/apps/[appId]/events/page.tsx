import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EventsManager } from "./EventsManager";

type Params = Promise<{ appId: string }>;

export default async function EventsPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("app_id", appId)
    .order("starts_at", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — events</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/dashboard/apps/${appId}/bookings`} className="underline">
            Bookings
          </Link>
          <Link href={`/dashboard/apps/${appId}/builder`} className="underline">
            Back to builder
          </Link>
        </div>
      </div>
      <EventsManager appId={appId} initialEvents={events ?? []} />
    </main>
  );
}
