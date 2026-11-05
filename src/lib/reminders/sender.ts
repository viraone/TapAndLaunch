import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken } from "@/lib/integrations/google/connection";
import type { Database } from "@/types/database";
import { buildRawMessage } from "./mime";
import { sendViaGmail } from "./gmail";
import { reminderValues, renderReminder } from "./render";
import {
  MAX_ATTEMPTS,
  MIN_LEAD_MINUTES,
  PER_APP_LIMIT,
  PER_RUN_LIMIT,
  STALE_SENDING_MINUTES,
  claimAction,
  errorCodeForSend,
  isDue,
  isRetryableSendFailure,
  type ReminderLogStatus,
} from "./due";

/**
 * The automatic sender, run by Vercel's cron route every five minutes.
 *
 * A visit is claimed (a reminder_log row inserted) BEFORE Gmail is asked to send, so two overlapping runs can never
 * both email the same visit. Nothing here logs a token, a message body or Gmail's answer: console output and the
 * log's `error` column carry a short code only.
 */

type Admin = ReturnType<typeof createAdminClient>;

type ReminderSettingsRow = Pick<
  Database["public"]["Tables"]["reminder_settings"]["Row"],
  "app_id" | "hours_before" | "subject" | "body" | "prep_note"
>;

type LogSummary = Pick<
  Database["public"]["Tables"]["reminder_log"]["Row"],
  "status" | "attempts" | "updated_at"
>;

const KIND = "before";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Bounds the candidate query. The per-app cap is what actually limits the work; this only has to be large enough that
 * a window full of already-sent visits does not hide the ones that just became due. Kept at 100 so the visit ids in
 * the follow-up `in (...)` filter stay a comfortable URL length.
 */
const CANDIDATE_LIMIT = PER_APP_LIMIT * 5;

export interface ReminderRunSummary {
  apps: number;
  sent: number;
  failed: number;
  skipped: number;
  limited: boolean;
}

export type ClaimOutcome =
  | { action: "claimed" | "retry" | "interrupted"; id: string }
  | { action: "leave" };

/** Whether Gmail is being rate-limited (or refusing this account) and the rest of the app should wait. */
function stopsApp(status: number): boolean {
  return status === 403 || status === 429;
}

function isStaleSending(row: { updated_at: string }, now: Date): boolean {
  return now.getTime() - new Date(row.updated_at).getTime() > STALE_SENDING_MINUTES * 60_000;
}

/** A candidate is worth claiming only when no row exists, a failed row may be retried, or a sending row is stale. */
function needsWork(row: LogSummary | null, now: Date): boolean {
  if (!row) return true;
  if (row.status === "sending") return isStaleSending(row, now);
  return (
    claimAction(
      {
        status: row.status as ReminderLogStatus,
        attempts: row.attempts,
        updatedAt: new Date(row.updated_at),
      },
      now
    ) === "retry"
  );
}

/**
 * Claims one visit for this run. The insert is the lock: a conflicting row means another run already has it, so we
 * look at the existing row and only take over a failed one (guarded by status and attempts) or clean up a sending
 * row left behind by a dead run. A stale sending row is never sent again.
 */
export async function claimReminder(
  admin: Admin,
  input: { appId: string; visitId: string; now: Date }
): Promise<ClaimOutcome> {
  const { data: inserted, error: insertError } = await admin
    .from("reminder_log")
    .upsert(
      {
        app_id: input.appId,
        visit_id: input.visitId,
        kind: KIND,
        status: "sending",
        attempts: 1,
      },
      { onConflict: "visit_id,kind", ignoreDuplicates: true }
    )
    .select("id");

  if (insertError) throw insertError;

  const newRow = inserted?.[0];
  if (newRow) return { action: "claimed", id: newRow.id };

  const { data: existing, error: readError } = await admin
    .from("reminder_log")
    .select("id, status, attempts, updated_at")
    .eq("visit_id", input.visitId)
    .eq("kind", KIND)
    .maybeSingle();

  if (readError) throw readError;
  if (!existing) return { action: "leave" };

  const status = existing.status as ReminderLogStatus;

  if (status === "sending" && isStaleSending(existing, input.now)) {
    const { data: marked, error: markError } = await admin
      .from("reminder_log")
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
    { status, attempts: existing.attempts, updatedAt: new Date(existing.updated_at) },
    input.now
  );
  if (action !== "retry") return { action: "leave" };

  const { data: updated, error: updateError } = await admin
    .from("reminder_log")
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

/** Writes the one result of an attempt. A missing log update is reported but never stops the other visits. */
async function finish(
  admin: Admin,
  appId: string,
  id: string,
  patch: {
    status: "sent" | "failed" | "skipped";
    error: string | null;
    to_email: string | null;
    /** Set to MAX_ATTEMPTS when Gmail's answer says trying again cannot help. */
    attempts?: number;
  }
): Promise<void> {
  const { error } = await admin
    .from("reminder_log")
    .update(patch)
    .eq("id", id)
    .eq("status", "sending");

  if (error) console.error("Reminder sender could not update the log", appId, "log_update_failed");
}

interface ProcessAppInput {
  admin: Admin;
  app: { id: string; name: string };
  timeZone: string;
  settings: ReminderSettingsRow;
  token: { accessToken: string; email: string };
  now: Date;
  capacity: number;
}

async function processApp(input: ProcessAppInput): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  processed: number;
  limited: boolean;
}> {
  const { admin, app, timeZone, settings, token, now, capacity } = input;
  const result = { sent: 0, failed: 0, skipped: 0, processed: 0, limited: false };

  const earliest = new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000);
  const latest = new Date(now.getTime() + settings.hours_before * 60 * 60_000);

  const { data: visits, error: visitsError } = await admin
    .from("schedule_visits")
    .select("id, customer_id, starts_at, service")
    .eq("app_id", app.id)
    .in("status", ["scheduled", "confirmed"])
    .gt("starts_at", earliest.toISOString())
    .lte("starts_at", latest.toISOString())
    .order("starts_at", { ascending: true })
    .limit(CANDIDATE_LIMIT);

  if (visitsError) {
    console.error("Reminder sender could not read visits", app.id, visitsError.code ?? "unknown");
    return result;
  }

  const candidates = (visits ?? []).filter((visit) =>
    isDue({
      startsAt: new Date(visit.starts_at),
      hoursBefore: settings.hours_before,
      now,
    })
  );

  if (candidates.length === 0) return result;
  if (candidates.length === CANDIDATE_LIMIT) result.limited = true;

  // One read tells us which visits have already been handled. Without it, a window full of earlier sends could use
  // up the per-app cap before a later, still-unsent visit is ever reached.
  const { data: logRows, error: logError } = await admin
    .from("reminder_log")
    .select("visit_id, status, attempts, updated_at")
    .eq("app_id", app.id)
    .eq("kind", KIND)
    .in(
      "visit_id",
      candidates.map((visit) => visit.id)
    );

  if (logError) {
    console.error("Reminder sender could not read the log", app.id, logError.code ?? "unknown");
    return result;
  }

  const logByVisit = new Map((logRows ?? []).map((row) => [row.visit_id, row]));
  const actionable = candidates.filter((visit) => needsWork(logByVisit.get(visit.id) ?? null, now));
  if (actionable.length === 0) return result;

  const batch = actionable.slice(0, capacity);
  if (batch.length < actionable.length) result.limited = true;

  // The customer is always looked up inside this app; the address can never come from anywhere else.
  const customerIds = [...new Set(batch.map((visit) => visit.customer_id))];
  const { data: customers, error: customersError } = await admin
    .from("schedule_customers")
    .select("id, name, email, address")
    .eq("app_id", app.id)
    .in("id", customerIds);

  if (customersError) {
    console.error(
      "Reminder sender could not read customers",
      app.id,
      customersError.code ?? "unknown"
    );
    return result;
  }

  const customerById = new Map((customers ?? []).map((customer) => [customer.id, customer]));

  for (const visit of batch) {
    let claim: ClaimOutcome | null = null;
    try {
      claim = await claimReminder(admin, { appId: app.id, visitId: visit.id, now });
    } catch {
      console.error("Reminder sender could not claim a visit", app.id, "claim_failed");
    }

    if (!claim || claim.action === "leave") continue;
    result.processed += 1;

    if (claim.action === "interrupted") {
      result.failed += 1;
      continue;
    }

    const customer = customerById.get(visit.customer_id);
    const email = customer?.email?.trim() ?? "";

    if (!customer || email.length === 0) {
      await finish(admin, app.id, claim.id, {
        status: "skipped",
        error: "no_email",
        to_email: null,
      });
      result.skipped += 1;
      continue;
    }

    if (!EMAIL_PATTERN.test(email) || /[\r\n]/.test(email)) {
      await finish(admin, app.id, claim.id, {
        status: "skipped",
        error: "bad_address",
        to_email: email,
      });
      result.skipped += 1;
      continue;
    }

    try {
      const rendered = renderReminder(
        settings,
        reminderValues({
          name: customer.name,
          address: customer.address,
          service: visit.service,
          business: app.name,
          startsAt: new Date(visit.starts_at),
          timeZone,
        })
      );

      const raw = buildRawMessage({
        fromName: app.name,
        fromEmail: token.email,
        // Only ever the customer's saved address; it was checked above.
        to: email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });

      const sent = await sendViaGmail(token.accessToken, raw);

      if (sent.ok) {
        await finish(admin, app.id, claim.id, { status: "sent", error: null, to_email: email });
        result.sent += 1;
      } else {
        await finish(admin, app.id, claim.id, {
          status: "failed",
          error: errorCodeForSend(sent.status),
          to_email: email,
          // A bad address or a broken grant is not fixed by asking again; a network hiccup, a rate limit or a
          // Google outage is.
          ...(isRetryableSendFailure(sent.status) ? {} : { attempts: MAX_ATTEMPTS }),
        });
        result.failed += 1;

        // Gmail is asking us to stop. Leave the rest of this app for the next run; other apps may still be fine.
        if (stopsApp(sent.status)) break;
      }
    } catch {
      console.error("Reminder sender could not send a reminder", app.id, "send_failed");
      await finish(admin, app.id, claim.id, {
        status: "failed",
        error: "send_failed",
        to_email: email,
      });
      result.failed += 1;
    }
  }

  return result;
}

/**
 * Emails every due reminder once, from each app's connected Gmail account.
 *
 * `now` exists for tests; the cron route calls it with the real clock.
 */
export async function runReminderSender(
  options: { now?: Date } = {}
): Promise<ReminderRunSummary> {
  const now = options.now ?? new Date();
  const summary: ReminderRunSummary = {
    apps: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    limited: false,
  };

  const admin = createAdminClient();
  const { data: settingsRows, error } = await admin
    .from("reminder_settings")
    .select("app_id, hours_before, subject, body, prep_note")
    .eq("enabled", true)
    .order("app_id", { ascending: true });

  if (error) {
    console.error("Reminder sender could not read settings", "settings_failed");
    return summary;
  }

  let remaining = PER_RUN_LIMIT;

  for (const settings of settingsRows ?? []) {
    if (remaining <= 0) {
      summary.limited = true;
      break;
    }

    const [{ data: app }, { data: schedule }] = await Promise.all([
      admin
        .from("apps")
        .select("id, name, deleted_at, suspended_at")
        .eq("id", settings.app_id)
        .maybeSingle(),
      admin
        .from("schedule_settings")
        .select("time_zone")
        .eq("app_id", settings.app_id)
        .maybeSingle(),
    ]);

    if (!app || app.deleted_at || app.suspended_at || !schedule) continue;

    // One token per app, before any row is touched. Without a working grant the whole app is skipped silently.
    const token = await getAccessToken(settings.app_id);
    if (!token.ok) continue;

    summary.apps += 1;
    const appResult = await processApp({
      admin,
      app,
      timeZone: schedule.time_zone,
      settings,
      token,
      now,
      capacity: Math.min(PER_APP_LIMIT, remaining),
    });

    summary.sent += appResult.sent;
    summary.failed += appResult.failed;
    summary.skipped += appResult.skipped;
    summary.limited = summary.limited || appResult.limited;
    remaining -= appResult.processed;
  }

  return summary;
}
