import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { TurnOnScheduling } from "../schedule/TurnOnScheduling";
import { AutomationManager } from "./AutomationManager";

type Params = Promise<{ appId: string }>;

/** Automation for an app with Scheduling on: messages to chosen people, sent from the owner's own Gmail. */
export default async function AutomationPage({ params }: { params: Params }) {
  const { appId } = await params;
  const supabase = await createClient();

  const { data: app } = await supabase.from("apps").select("id, name").eq("id", appId).maybeSingle();
  if (!app) notFound();

  if (!(await isAppEditor(supabase, appId))) notFound();

  const { data: settings } = await supabase
    .from("schedule_settings")
    .select("app_id")
    .eq("app_id", appId)
    .maybeSingle();

  return (
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

      {settings ? (
        <AutomationManager appId={appId} appName={app.name} />
      ) : (
        <TurnOnScheduling appId={appId} />
      )}
    </main>
  );
}
