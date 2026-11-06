import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { TurnOnScheduling } from "../schedule/TurnOnScheduling";
import { GMAIL_MESSAGES } from "@/lib/integrations/google/messages";
import { SchedulingShell } from "../SchedulingShell";
import { AutomationManager } from "./AutomationManager";

type Params = Promise<{ appId: string }>;

/** Automation for an app with Scheduling on: messages to chosen people, sent from the owner's own Gmail. */
export default async function AutomationPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<{ gmail?: string }>;
}) {
  const { appId } = await params;
  const { gmail } = await searchParams;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  if (!(await isAppEditor(supabase, appId))) notFound();

  const { data: settings } = await supabase
    .from("schedule_settings")
    .select("app_id")
    .eq("app_id", appId)
    .maybeSingle();

  // Google sends the owner back here after connecting from this screen; say how it went.
  const result = gmail ? GMAIL_MESSAGES.get(gmail) : undefined;

  const screen = (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{app.name} — automation</h1>
        <Link href={`/dashboard/apps/${appId}`} className="text-sm underline">
          Back to app
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Send a message to the people you choose, on the day and time you pick, from your own Gmail.
      </p>

      {result && (
        <p role="status" className="mb-4 rounded-xl bg-white px-4 py-3 text-sm text-neutral-700 ring-1 ring-black/5">
          {result}
        </p>
      )}

      {settings ? (
        <AutomationManager appId={appId} appName={app.name} />
      ) : (
        <TurnOnScheduling appId={appId} />
      )}
    </main>
  );

  return settings ? (
    <SchedulingShell appId={appId} active="automation">
      {screen}
    </SchedulingShell>
  ) : (
    screen
  );
}
