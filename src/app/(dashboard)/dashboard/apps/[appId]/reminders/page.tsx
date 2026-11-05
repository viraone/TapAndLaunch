import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { getConnectionStatus } from "@/lib/integrations/google/connection";
import { isGoogleConfigured } from "@/lib/integrations/google/oauth";
import { TurnOnScheduling } from "../schedule/TurnOnScheduling";
import { ConnectGmailCard } from "./ConnectGmailCard";

type Params = Promise<{ appId: string }>;

// A Map so an unknown value such as "constructor" from the query string simply shows nothing.
const GMAIL_MESSAGES = new Map<string, string>([
  ["connected", "Gmail is connected."],
  ["cancelled", "You closed Google's screen before finishing."],
  ["missing_permission", "Google didn't give permission to send email. Connect again and leave that box ticked."],
  ["failed", "That didn't work. Please try again."],
  ["unavailable", "Connecting Gmail isn't available yet."],
]);

/** Reminders for an app with Scheduling on. For now the only thing here is the Gmail connection. */
export default async function RemindersPage({
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

  const result = gmail ? GMAIL_MESSAGES.get(gmail) : undefined;
  const resultLine = result ? (
    <p role="status" className="mb-4 rounded-xl bg-white px-4 py-3 text-sm text-neutral-700 ring-1 ring-black/5">
      {result}
    </p>
  ) : null;

  if (!settings) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{app.name} — reminders</h1>
          <Link href={`/dashboard/apps/${appId}`} className="text-sm underline">
            Back to app
          </Link>
        </div>
        {resultLine}
        <TurnOnScheduling appId={appId} />
      </main>
    );
  }

  const status = await getConnectionStatus(appId);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{app.name} — reminders</h1>
        <Link href={`/dashboard/apps/${appId}`} className="text-sm underline">
          Back to app
        </Link>
      </div>
      {resultLine}
      <ConnectGmailCard appId={appId} status={status} configured={isGoogleConfigured()} />
    </main>
  );
}
