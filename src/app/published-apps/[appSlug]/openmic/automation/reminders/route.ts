import { automationCaller } from "@/lib/automation/auth";
import { openMicConfigFor } from "@/lib/automation/config";
import { RECENT_LOG_LIMIT, reminderState } from "@/lib/automation/state";
import { parseAutomationInput } from "@/lib/automation/validate";
import { zonedTimeToUtc } from "@/lib/schedule/recurrence";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AutomationReminderRow } from "@/types/database";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REMINDERS = 10;
const DEFAULT_TIME_ZONE = "America/Los_Angeles";
const PAST_ERROR = "That date and time have already passed.";
const NOT_FOUND = "Reminder not found";

type ExistingReminder = Pick<
  AutomationReminderRow,
  "id" | "enabled" | "schedule_kind" | "weekday" | "once_date" | "send_time" | "time_zone"
>;

/** PostgREST returns times as "HH:MM:SS"; the screen sends "HH:MM". Compare them in one form. */
function shortTime(value: string): string {
  return value.slice(0, 5);
}

function serverError(message: string): Response {
  return Response.json({ error: message }, { status: 500 });
}

/** The instant of a one-off reminder, or null when its date or time zone can't be read. */
function onceInstant(
  input: { once_date: string | null; send_time: string },
  timeZone: string
): Date | null {
  try {
    return zonedTimeToUtc(input.once_date ?? "", input.send_time, timeZone);
  } catch {
    return null;
  }
}

/**
 * Creates or updates one reminder and replaces its recipient list. A save never touches `enabled`; the only time
 * `activated_at` moves is when an enabled reminder's schedule changes, so an edit can't make a moment that already
 * passed suddenly send.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

  const parsed = parseAutomationInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;

  const admin = createAdminClient();
  const now = new Date();

  let existing: ExistingReminder | null = null;
  if (input.id) {
    const { data, error } = await admin
      .from("automation_reminders")
      .select("id, enabled, schedule_kind, weekday, once_date, send_time, time_zone")
      .eq("id", input.id)
      .eq("app_id", caller.appId)
      .maybeSingle();
    if (error) {
      console.error("Automation save could not read the reminder", caller.appId, "reminder_read_failed");
      return serverError("Could not load the reminder.");
    }
    if (!data) return Response.json({ error: NOT_FOUND }, { status: 404 });
    existing = data;
  } else {
    const { count, error } = await admin
      .from("automation_reminders")
      .select("id", { count: "exact", head: true })
      .eq("app_id", caller.appId);
    if (error) {
      console.error("Automation save could not count reminders", caller.appId, "count_failed");
      return serverError("Could not save the reminder. Try again.");
    }
    if ((count ?? 0) >= MAX_REMINDERS) {
      return Response.json({ error: "You can keep up to 10 reminders." }, { status: 400 });
    }
  }

  const config = existing ? null : await openMicConfigFor(caller.appId);
  const timeZone = existing?.time_zone ?? config?.time_zone ?? DEFAULT_TIME_ZONE;

  if (input.schedule_kind === "once") {
    const onceAt = onceInstant({ once_date: input.once_date, send_time: input.send_time }, timeZone);
    if (!onceAt || onceAt.getTime() <= now.getTime()) {
      return Response.json({ error: PAST_ERROR }, { status: 400 });
    }
  }

  let reminderId: string;
  if (existing) {
    const scheduleChanged =
      existing.schedule_kind !== input.schedule_kind ||
      (existing.weekday ?? null) !== (input.weekday ?? null) ||
      (existing.once_date ?? null) !== (input.once_date ?? null) ||
      shortTime(existing.send_time) !== shortTime(input.send_time) ||
      existing.time_zone !== timeZone;

    const { error } = await admin
      .from("automation_reminders")
      .update({
        name: input.name,
        schedule_kind: input.schedule_kind,
        weekday: input.weekday,
        once_date: input.once_date,
        send_time: input.send_time,
        subject: input.subject,
        body: input.body,
        ...(existing.enabled && scheduleChanged ? { activated_at: now.toISOString() } : {}),
      })
      .eq("id", existing.id)
      .eq("app_id", caller.appId);
    if (error) {
      console.error("Automation save could not update the reminder", caller.appId, "reminder_update_failed");
      return serverError("Could not save the reminder. Try again.");
    }
    reminderId = existing.id;
  } else {
    const { data, error } = await admin
      .from("automation_reminders")
      .insert({
        app_id: caller.appId,
        name: input.name,
        schedule_kind: input.schedule_kind,
        weekday: input.weekday,
        once_date: input.once_date,
        send_time: input.send_time,
        time_zone: timeZone,
        subject: input.subject,
        body: input.body,
      })
      .select("id")
      .single();
    if (error || !data) {
      console.error("Automation save could not insert the reminder", caller.appId, "reminder_insert_failed");
      return serverError("Could not save the reminder. Try again.");
    }
    reminderId = data.id;
  }

  // Replace the list exactly: drop the addresses the caller removed, upsert the rest (keeping a kept row's created_at).
  const { data: currentRecipients, error: recipientsReadError } = await admin
    .from("automation_recipients")
    .select("id, email")
    .eq("reminder_id", reminderId)
    .eq("app_id", caller.appId);
  if (recipientsReadError) {
    console.error("Automation save could not read recipients", caller.appId, "recipients_read_failed");
    return serverError("Could not save the reminder. Try again.");
  }

  const wanted = new Set(input.recipients.map((recipient) => recipient.email));
  const removed = (currentRecipients ?? [])
    .filter((recipient) => !wanted.has(recipient.email))
    .map((recipient) => recipient.id);
  if (removed.length > 0) {
    const { error } = await admin
      .from("automation_recipients")
      .delete()
      .in("id", removed)
      .eq("app_id", caller.appId);
    if (error) {
      console.error("Automation save could not delete recipients", caller.appId, "recipients_delete_failed");
      return serverError("Could not save the reminder. Try again.");
    }
  }

  if (input.recipients.length > 0) {
    const { error } = await admin.from("automation_recipients").upsert(
      input.recipients.map((recipient) => ({
        reminder_id: reminderId,
        app_id: caller.appId,
        name: recipient.name,
        email: recipient.email,
      })),
      { onConflict: "reminder_id,email" }
    );
    if (error) {
      console.error("Automation save could not save recipients", caller.appId, "recipients_upsert_failed");
      return serverError("Could not save the reminder. Try again.");
    }
  }

  const { data: log, error: logError } = await admin
    .from("automation_send_log")
    .select("occurrence_at, status")
    .eq("app_id", caller.appId)
    .eq("reminder_id", reminderId)
    .order("occurrence_at", { ascending: false })
    .limit(RECENT_LOG_LIMIT);
  if (logError) {
    console.error("Automation save could not read the send log", caller.appId, "log_failed");
    return serverError("Could not load the reminder.");
  }

  return Response.json({
    reminder: reminderState(
      {
        id: reminderId,
        name: input.name,
        enabled: existing?.enabled ?? false,
        schedule_kind: input.schedule_kind,
        weekday: input.weekday,
        once_date: input.once_date,
        send_time: input.send_time,
        time_zone: timeZone,
        subject: input.subject,
        body: input.body,
      },
      input.recipients,
      log ?? [],
      now
    ),
  });
}

/** Deletes one reminder; its recipients and send log follow by cascade. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: NOT_FOUND }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("automation_reminders")
    .delete()
    .eq("id", id)
    .eq("app_id", caller.appId)
    .select("id");
  if (error) {
    console.error("Automation delete failed", caller.appId, "reminder_delete_failed");
    return serverError("Could not delete the reminder. Try again.");
  }
  if (!data || data.length === 0) {
    return Response.json({ error: NOT_FOUND }, { status: 404 });
  }

  return Response.json({ ok: true });
}
