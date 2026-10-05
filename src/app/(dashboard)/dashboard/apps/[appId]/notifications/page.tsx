import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isPushConfigured } from "@/lib/notifications/push";
import { isEmailConfigured } from "@/lib/notifications/email";
import { isSmsConfigured } from "@/lib/notifications/sms";
import { ComposeForm } from "./ComposeForm";
import { LocalTime } from "@/components/dashboard/LocalTime";

type Params = Promise<{ appId: string }>;

const CHANNEL_LABEL: Record<string, string> = {
  push_sent: "Web push",
  email_sent: "Email",
  sms_sent: "SMS",
};

export default async function NotificationsPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  const [{ count: pushCount }, { count: memberCount }, { count: phoneCount }] = await Promise.all([
    supabase.from("push_subscriptions").select("*", { count: "exact", head: true }).eq("app_id", appId),
    supabase.from("app_members").select("*", { count: "exact", head: true }).eq("app_id", appId),
    supabase
      .from("app_members")
      .select("*", { count: "exact", head: true })
      .eq("app_id", appId)
      .not("phone", "is", null),
  ]);

  const { data: recentSends } = await supabase
    .from("analytics_events")
    .select("event_type, metadata, created_at")
    .eq("app_id", appId)
    .in("event_type", ["push_sent", "email_sent", "sms_sent"])
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{app.name} — notifications</h1>
        <Link href={`/dashboard/apps/${appId}/builder`} className="text-sm underline">
          Back to builder
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4 text-sm">
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground">Push subscribers</p>
          <p className="text-xl font-semibold">{pushCount ?? 0}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground">Members (email)</p>
          <p className="text-xl font-semibold">{memberCount ?? 0}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-muted-foreground">Members with phone</p>
          <p className="text-xl font-semibold">{phoneCount ?? 0}</p>
        </div>
      </div>

      <div className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-medium">Compose</h2>
        <ComposeForm
          appId={appId}
          channelsConfigured={{
            push: isPushConfigured(),
            email: isEmailConfigured(),
            sms: isSmsConfigured(),
          }}
        />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium">Recent sends</h2>
        {!recentSends || recentSends.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
        ) : (
          <div className="space-y-2">
            {recentSends.map((event, i) => {
              const metadata = event.metadata as { title?: string; sent?: number; failed?: number };
              return (
                <div key={i} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{metadata.title ?? "(untitled)"}</span>
                    <span className="text-xs text-muted-foreground">
                      <LocalTime iso={event.created_at} />
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {CHANNEL_LABEL[event.event_type] ?? event.event_type} · {metadata.sent ?? 0} sent
                    {metadata.failed ? `, ${metadata.failed} failed` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
