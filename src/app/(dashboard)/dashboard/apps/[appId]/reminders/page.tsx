import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { getConnectionStatus } from "@/lib/integrations/google/connection";
import { isGoogleConfigured } from "@/lib/integrations/google/oauth";
import { addDays, localDateOf, zonedTimeToUtc } from "@/lib/schedule/recurrence";
import { DEFAULT_REMINDER } from "@/lib/reminders/render";
import type { ReminderSettingsInput } from "@/lib/reminders/validate";
import { TurnOnScheduling } from "../schedule/TurnOnScheduling";
import { AutomaticRemindersCard } from "./AutomaticRemindersCard";
import { GMAIL_MESSAGES } from "@/lib/integrations/google/messages";
import { ConnectGmailCard } from "./ConnectGmailCard";
import { RecentReminders } from "./RecentReminders";
import { ReminderSettingsForm } from "./ReminderSettingsForm";

type Params = Promise<{ appId: string }>;

/** Reminders for an app with Scheduling on: the Gmail connection, then the email editor once it can send. */
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
    .select("app_id, time_zone")
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

  const { data: reminder } = await supabase
    .from("reminder_settings")
    .select("enabled, hours_before, subject, body, prep_note")
    .eq("app_id", appId)
    .maybeSingle();

  const initialSettings: ReminderSettingsInput = reminder
    ? {
        // The table's check constraint keeps this one of the allowed choices.
        hours_before: reminder.hours_before as ReminderSettingsInput["hours_before"],
        subject: reminder.subject,
        body: reminder.body,
        prep_note: reminder.prep_note,
      }
    : DEFAULT_REMINDER;

  const sampleDate = addDays(localDateOf(new Date(), settings.time_zone), 1);
  const sampleStartsAt = zonedTimeToUtc(
    sampleDate,
    "10:00",
    settings.time_zone
  ).toISOString();

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
      {status.connected && status.canSend && !status.needsReconnect && (
        <div className="mt-6 space-y-6">
          <AutomaticRemindersCard
            appId={appId}
            enabled={reminder?.enabled ?? false}
            hoursBefore={initialSettings.hours_before}
            hasSavedReminder={Boolean(reminder)}
          />
          <ReminderSettingsForm
            appId={appId}
            business={app.name}
            timeZone={settings.time_zone}
            email={status.email ?? ""}
            sampleStartsAt={sampleStartsAt}
            initialSettings={initialSettings}
          />
        </div>
      )}
      <div className="mt-6">
        <RecentReminders appId={appId} timeZone={settings.time_zone} />
      </div>
    </main>
  );
}
