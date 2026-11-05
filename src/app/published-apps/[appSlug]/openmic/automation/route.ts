import { automationCaller } from "@/lib/automation/auth";
import { contactListUrlFor, openMicConfigFor } from "@/lib/automation/config";
import { automationDefaultsFor } from "@/lib/automation/defaults";
import { RECENT_LOG_LIMIT, reminderState } from "@/lib/automation/state";
import { getConnectionStatus } from "@/lib/integrations/google/connection";
import { isGoogleConfigured } from "@/lib/integrations/google/oauth";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_TIME_ZONE = "America/Los_Angeles";

/**
 * Everything the Automation screen shows: the Gmail connection, the show's name and time zone, and every saved
 * reminder with its recipients and its last few sends. Hosts listed in the Automation block only.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

  const admin = createAdminClient();
  const [gmail, config, contactListUrl] = await Promise.all([
    getConnectionStatus(caller.appId),
    openMicConfigFor(caller.appId),
    contactListUrlFor(caller.appId),
  ]);

  const { data: reminderRows, error: remindersError } = await admin
    .from("automation_reminders")
    .select("id, name, enabled, schedule_kind, weekday, once_date, send_time, time_zone, subject, body")
    .eq("app_id", caller.appId)
    .order("created_at", { ascending: true });
  if (remindersError) {
    console.error("Automation screen could not read reminders", caller.appId, "reminders_failed");
    return Response.json({ error: "Could not load the reminders." }, { status: 500 });
  }

  const { data: recipientRows, error: recipientsError } = await admin
    .from("automation_recipients")
    .select("reminder_id, name, email")
    .eq("app_id", caller.appId)
    .order("created_at", { ascending: true });
  if (recipientsError) {
    console.error("Automation screen could not read recipients", caller.appId, "recipients_failed");
    return Response.json({ error: "Could not load the reminders." }, { status: 500 });
  }

  const recipientsByReminder = new Map<string, { name: string | null; email: string }[]>();
  for (const recipient of recipientRows ?? []) {
    const list = recipientsByReminder.get(recipient.reminder_id) ?? [];
    list.push({ name: recipient.name, email: recipient.email });
    recipientsByReminder.set(recipient.reminder_id, list);
  }

  const rows = reminderRows ?? [];
  const logs = await Promise.all(
    rows.map((row) =>
      admin
        .from("automation_send_log")
        .select("occurrence_at, status")
        .eq("app_id", caller.appId)
        .eq("reminder_id", row.id)
        .order("occurrence_at", { ascending: false })
        .limit(RECENT_LOG_LIMIT)
    )
  );
  if (logs.some((log) => log.error)) {
    console.error("Automation screen could not read the send log", caller.appId, "log_failed");
    return Response.json({ error: "Could not load the reminders." }, { status: 500 });
  }

  const now = new Date();
  const reminders = rows.map((row, index) =>
    reminderState(
      row,
      recipientsByReminder.get(row.id) ?? [],
      logs[index]?.data ?? [],
      now
    )
  );

  return Response.json({
    gmail: {
      configured: isGoogleConfigured(),
      connected: gmail.connected,
      email: gmail.email,
      canSend: gmail.canSend,
      canReadContacts: gmail.canReadContacts,
      canReadOtherContacts: gmail.canReadOtherContacts,
      needsReconnect: gmail.needsReconnect,
    },
    showName: config?.show_name ?? caller.appName,
    timeZone: config?.time_zone ?? DEFAULT_TIME_ZONE,
    reminders,
    defaults: automationDefaultsFor(config),
    contactList: contactListUrl !== null,
  });
}
