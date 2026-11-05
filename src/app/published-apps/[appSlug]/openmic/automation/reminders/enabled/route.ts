import { automationCaller } from "@/lib/automation/auth";
import { getConnectionStatus } from "@/lib/integrations/google/connection";
import { zonedTimeToUtc } from "@/lib/schedule/recurrence";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAST_ERROR = "That date and time have already passed.";
const NOT_FOUND = "Reminder not found";

/** The instant of a one-off reminder, or null when its date or time zone can't be read. */
function onceInstant(
  reminder: { once_date: string | null; send_time: string; time_zone: string }
): Date | null {
  try {
    return zonedTimeToUtc(reminder.once_date ?? "", reminder.send_time, reminder.time_zone);
  } catch {
    return null;
  }
}

/**
 * Switches one reminder on or off. Turning on is refused unless Gmail can still send, there is someone to send to,
 * and a one-off moment has not already passed. Switching on sets `activated_at` to now, so only a later occurrence
 * can ever go out.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

  const raw: unknown = await request.json().catch(() => null);
  const body =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const id = typeof body.id === "string" ? body.id : "";
  const enabled = body.enabled;
  if (!UUID_PATTERN.test(id) || typeof enabled !== "boolean") {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reminder, error } = await admin
    .from("automation_reminders")
    .select("id, enabled, schedule_kind, once_date, send_time, time_zone")
    .eq("id", id)
    .eq("app_id", caller.appId)
    .maybeSingle();
  if (error) {
    console.error("Automation switch could not read the reminder", caller.appId, "reminder_read_failed");
    return Response.json({ error: "Could not change the reminder. Try again." }, { status: 500 });
  }
  if (!reminder) return Response.json({ error: NOT_FOUND }, { status: 404 });

  const now = new Date();

  if (enabled) {
    const gmail = await getConnectionStatus(caller.appId);
    if (!gmail.connected || !gmail.canSend || gmail.needsReconnect) {
      return Response.json({ error: "Connect Gmail first." }, { status: 400 });
    }

    const { count, error: countError } = await admin
      .from("automation_recipients")
      .select("id", { count: "exact", head: true })
      .eq("reminder_id", reminder.id)
      .eq("app_id", caller.appId);
    if (countError) {
      console.error("Automation switch could not count recipients", caller.appId, "count_failed");
      return Response.json(
        { error: "Could not change the reminder. Try again." },
        { status: 500 }
      );
    }
    if ((count ?? 0) === 0) {
      return Response.json({ error: "Add at least one person first." }, { status: 400 });
    }

    if (reminder.schedule_kind === "once") {
      const onceAt = onceInstant(reminder);
      if (!onceAt || onceAt.getTime() <= now.getTime()) {
        return Response.json({ error: PAST_ERROR }, { status: 400 });
      }
    }
  }

  const { error: updateError } = await admin
    .from("automation_reminders")
    .update(
      enabled ? { enabled: true, activated_at: now.toISOString() } : { enabled: false }
    )
    .eq("id", reminder.id)
    .eq("app_id", caller.appId);
  if (updateError) {
    console.error("Automation switch could not update the reminder", caller.appId, "update_failed");
    return Response.json({ error: "Could not change the reminder. Try again." }, { status: 500 });
  }

  return Response.json({ enabled });
}
