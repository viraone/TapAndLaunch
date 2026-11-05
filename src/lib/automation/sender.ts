import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken } from "@/lib/integrations/google/connection";
import type { Database } from "@/types/database";
import { buildRawMessage } from "@/lib/reminders/mime";
import { sendViaGmail } from "@/lib/reminders/gmail";
import {
  MAX_ATTEMPTS,
  STALE_SENDING_MINUTES,
  claimAction,
  errorCodeForSend,
  isRetryableSendFailure,
} from "@/lib/reminders/due";
import { openMicConfigFor } from "./config";
import { automationValues, renderAutomation } from "./render";
import {
  isOccurrenceDue,
  latestOccurrence,
  showDateAfter,
  type AutomationRule,
} from "./schedule";

/**
 * The Automation tab's sender, run by the same five-minute cron route as the visit reminders.
 *
 * Every send is claimed with an automation_send_log row BEFORE Gmail is asked to send, on the
 * (reminder, occurrence, address) key, so two overlapping runs can never email the same person twice. Nothing here
 * logs a token, a message body or Gmail's answer: console output and the log's `error` column carry a short code only.
 */

type Admin = ReturnType<typeof createAdminClient>;

type ReminderRow = Pick<
  Database["public"]["Tables"]["automation_reminders"]["Row"],
  | "id"
  | "app_id"
  | "schedule_kind"
  | "weekday"
  | "once_date"
  | "send_time"
  | "time_zone"
  | "subject"
  | "body"
  | "activated_at"
>;

type AppRow = { id: string; name: string };

type Token = { accessToken: string; email: string };

/** At most this many sends are attempted by one cron run; the rest resume on the next tick. */
export const AUTOMATION_PER_RUN_LIMIT = 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AutomationRunSummary {
  reminders: number;
  sent: number;
  failed: number;
  limited: boolean;
}

function ruleFor(reminder: ReminderRow): AutomationRule {
  return {
    scheduleKind: reminder.schedule_kind,
    weekday: reminder.weekday,
    onceDate: reminder.once_date,
    sendTime: reminder.send_time,
    timeZone: reminder.time_zone,
  };
}

function isStaleSending(row: { updated_at: string }, now: Date): boolean {
  return now.getTime() - new Date(row.updated_at).getTime() > STALE_SENDING_MINUTES * 60_000;
}

type ClaimOutcome =
  | { action: "claimed" | "retry" | "interrupted"; id: string }
  | { action: "leave" };

/**
 * Claims one send for this run. The insert is the lock: a conflicting row means another run already has it, so we
 * look at the existing row and only take over a failed one (guarded by status and attempts) or clean up a sending
 * row left behind by a dead run. A stale sending row is never sent again.
 */
async function claimAutomationSend(
  admin: Admin,
  input: { appId: string; reminderId: string; occurrenceAt: string; email: string; now: Date }
): Promise<ClaimOutcome> {
  const { data: inserted, error: insertError } = await admin
    .from("automation_send_log")
    .upsert(
      {
        app_id: input.appId,
        reminder_id: input.reminderId,
        occurrence_at: input.occurrenceAt,
        email: input.email,
        status: "sending",
        attempts: 1,
      },
      { onConflict: "reminder_id,occurrence_at,email", ignoreDuplicates: true }
    )
    .select("id");

  if (insertError) throw insertError;

  const newRow = inserted?.[0];
  if (newRow) return { action: "claimed", id: newRow.id };

  const { data: existing, error: readError } = await admin
    .from("automation_send_log")
    .select("id, status, attempts, updated_at")
    .eq("reminder_id", input.reminderId)
    .eq("occurrence_at", input.occurrenceAt)
    .eq("email", input.email)
    .maybeSingle();

  if (readError) throw readError;
  if (!existing) return { action: "leave" };

  if (existing.status === "sending" && isStaleSending(existing, input.now)) {
    const { data: marked, error: markError } = await admin
      .from("automation_send_log")
      .update({ status: "failed", error: "interrupted", attempts: MAX_ATTEMPTS })
      .eq("id", existing.id)
      .eq("status", "sending")
      .eq("attempts", existing.attempts)
      .select("id");

    if (markError) throw markError;
    return (marked?.length ?? 0) === 1
      ? { action: "interrupted", id: existing.id }
      : { action: "leave" };
  }

  const action = claimAction(
    {
      status: existing.status,
      attempts: existing.attempts,
      updatedAt: new Date(existing.updated_at),
    },
    input.now
  );
  if (action !== "retry") return { action: "leave" };

  const { data: updated, error: updateError } = await admin
    .from("automation_send_log")
    .update({ status: "sending", attempts: existing.attempts + 1, error: null })
    .eq("id", existing.id)
    .eq("status", "failed")
    .eq("attempts", existing.attempts)
    .select("id");

  if (updateError) throw updateError;
  return (updated?.length ?? 0) === 1
    ? { action: "retry", id: existing.id }
    : { action: "leave" };
}

/** Writes the one result of an attempt. A missing log update is reported but never stops the other recipients. */
async function finish(
  admin: Admin,
  appId: string,
  id: string,
  patch: { status: "sent" | "failed"; error: string | null; attempts?: number }
): Promise<void> {
  const { error } = await admin
    .from("automation_send_log")
    .update(patch)
    .eq("id", id)
    .eq("status", "sending");

  if (error) console.error("Automation sender could not update the log", appId, "log_update_failed");
}

/** A "once" reminder is finished, and switched off, when every recipient has a sent or terminal failed row. */
async function switchOffFinishedOnce(
  admin: Admin,
  reminder: ReminderRow,
  occurrenceAt: string,
  recipients: { email: string }[]
): Promise<void> {
  if (reminder.schedule_kind !== "once" || recipients.length === 0) return;

  const { data, error } = await admin
    .from("automation_send_log")
    .select("email, status, attempts")
    .eq("reminder_id", reminder.id)
    .eq("occurrence_at", occurrenceAt);

  if (error) {
    console.error("Automation sender could not read the log", reminder.app_id, "log_read_failed");
    return;
  }

  const byEmail = new Map((data ?? []).map((row) => [row.email, row]));
  const complete = recipients.every((recipient) => {
    const row = byEmail.get(recipient.email);
    return (
      row !== undefined &&
      (row.status === "sent" || (row.status === "failed" && row.attempts >= MAX_ATTEMPTS))
    );
  });
  if (!complete) return;

  const { error: updateError } = await admin
    .from("automation_reminders")
    .update({ enabled: false })
    .eq("id", reminder.id)
    .eq("enabled", true);

  if (updateError) {
    console.error("Automation sender could not switch a reminder off", reminder.app_id, "disable_failed");
  }
}

interface ProcessReminderInput {
  admin: Admin;
  app: AppRow;
  reminder: ReminderRow;
  occurrence: Date;
  token: Token;
  now: Date;
  capacity: number;
}

async function processReminder(input: ProcessReminderInput): Promise<{
  sent: number;
  failed: number;
  processed: number;
  limited: boolean;
}> {
  const { admin, app, reminder, occurrence, token, now, capacity } = input;
  const result = { sent: 0, failed: 0, processed: 0, limited: false };

  const config = await openMicConfigFor(reminder.app_id);
  const showWeekday = config?.opens_weekday ?? 5;
  const showName = config?.show_name ?? app.name;
  const showTime = config?.show_time ?? null;
  const venue = config?.venue ?? null;
  const showDate = showDateAfter(occurrence, showWeekday, reminder.time_zone);

  const { data: recipients, error: recipientsError } = await admin
    .from("automation_recipients")
    .select("name, email")
    .eq("reminder_id", reminder.id)
    .eq("app_id", reminder.app_id)
    .order("created_at", { ascending: true });

  if (recipientsError) {
    console.error(
      "Automation sender could not read recipients",
      reminder.app_id,
      recipientsError.code ?? "unknown"
    );
    return result;
  }

  const list = recipients ?? [];
  const occurrenceAt = occurrence.toISOString();
  let remaining = capacity;

  for (const recipient of list) {
    if (remaining <= 0) {
      result.limited = true;
      break;
    }

    const email = recipient.email;
    let claim: ClaimOutcome | null = null;
    try {
      claim = await claimAutomationSend(admin, {
        appId: reminder.app_id,
        reminderId: reminder.id,
        occurrenceAt,
        email,
        now,
      });
    } catch {
      console.error("Automation sender could not claim a send", reminder.app_id, "claim_failed");
    }

    if (!claim || claim.action === "leave") continue;
    result.processed += 1;
    remaining -= 1;

    if (claim.action === "interrupted") {
      result.failed += 1;
      continue;
    }

    if (!EMAIL_PATTERN.test(email) || /[\r\n]/.test(email)) {
      await finish(admin, reminder.app_id, claim.id, {
        status: "failed",
        error: "bad_address",
        attempts: MAX_ATTEMPTS,
      });
      result.failed += 1;
      continue;
    }

    try {
      const rendered = renderAutomation(
        { subject: reminder.subject, body: reminder.body },
        automationValues({
          name: recipient.name ?? email.split("@")[0] ?? email,
          showName,
          showDate,
          showTime,
          venue,
        })
      );

      const raw = buildRawMessage({
        fromName: showName,
        fromEmail: token.email,
        // Only ever the recipient row's saved address; it was checked above.
        to: email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });

      const sent = await sendViaGmail(token.accessToken, raw);

      if (sent.ok) {
        await finish(admin, reminder.app_id, claim.id, { status: "sent", error: null });
        result.sent += 1;
      } else {
        await finish(admin, reminder.app_id, claim.id, {
          status: "failed",
          error: errorCodeForSend(sent.status),
          ...(isRetryableSendFailure(sent.status) ? {} : { attempts: MAX_ATTEMPTS }),
        });
        result.failed += 1;

        // Gmail is asking us to stop. Leave the rest of this reminder for the next run.
        if (sent.status === 403 || sent.status === 429) break;
      }
    } catch {
      console.error("Automation sender could not send an email", reminder.app_id, "send_failed");
      await finish(admin, reminder.app_id, claim.id, {
        status: "failed",
        error: "send_failed",
      });
      result.failed += 1;
    }
  }

  await switchOffFinishedOnce(admin, reminder, occurrenceAt, list);

  return result;
}

/**
 * Emails one due occurrence of every enabled automation, from the app's connected Gmail account.
 *
 * `now` exists for tests; the cron route calls it with the real clock.
 */
export async function runAutomationSender(
  options: { now?: Date } = {}
): Promise<{ reminders: number; sent: number; failed: number; limited: boolean }> {
  const now = options.now ?? new Date();
  const summary = { reminders: 0, sent: 0, failed: 0, limited: false };

  const admin = createAdminClient();
  const { data: reminderRows, error } = await admin
    .from("automation_reminders")
    .select(
      "id, app_id, schedule_kind, weekday, once_date, send_time, time_zone, subject, body, activated_at"
    )
    .eq("enabled", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Automation sender could not read reminders", "reminders_failed");
    return summary;
  }

  // One token per app per run, however many automations that app has.
  const tokens = new Map<string, Awaited<ReturnType<typeof getAccessToken>>>();
  let remaining = AUTOMATION_PER_RUN_LIMIT;

  for (const reminder of reminderRows ?? []) {
    if (remaining <= 0) {
      summary.limited = true;
      break;
    }

    const { data: app } = await admin
      .from("apps")
      .select("id, name, deleted_at, suspended_at")
      .eq("id", reminder.app_id)
      .maybeSingle();

    if (!app || app.deleted_at || app.suspended_at) continue;

    const occurrence = latestOccurrence(ruleFor(reminder), now);
    if (
      !occurrence ||
      !isOccurrenceDue({
        occurrence,
        now,
        activatedAt: reminder.activated_at ? new Date(reminder.activated_at) : null,
      })
    ) {
      continue;
    }

    const cached = tokens.get(reminder.app_id);
    const token = cached ?? (await getAccessToken(reminder.app_id));
    if (!cached) tokens.set(reminder.app_id, token);
    if (!token.ok) continue;

    summary.reminders += 1;

    const result = await processReminder({
      admin,
      app,
      reminder,
      occurrence,
      token,
      now,
      capacity: remaining,
    });

    summary.sent += result.sent;
    summary.failed += result.failed;
    summary.limited = summary.limited || result.limited;
    remaining -= result.processed;
  }

  return summary;
}
