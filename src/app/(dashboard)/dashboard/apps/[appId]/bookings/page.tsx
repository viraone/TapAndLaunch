import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ appId: string }>;

export default async function BookingsPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: events } = await supabase.from("events").select("id, title").eq("app_id", appId);
  const titleByEventId = new Map((events ?? []).map((e) => [e.id, e.title]));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — bookings</h1>
        <Link href={`/dashboard/apps/${appId}/events`} className="text-sm underline">
          Manage events
        </Link>
      </div>

      {!bookings || bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings yet.</p>
      ) : (
        <div className="space-y-2">
          {bookings.map((booking) => (
            <div key={booking.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{booking.customer_name}</p>
                <p className="text-xs text-muted-foreground">{booking.customer_email}</p>
              </div>
              <div className="text-right">
                <p>{titleByEventId.get(booking.event_id) ?? "Unknown event"}</p>
                <p className="text-xs text-muted-foreground">{new Date(booking.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
