import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationReminderRow, Database } from "@/types/database";
import { getAccessToken, getConnectionStatus } from "@/lib/integrations/google/connection";
import { listContacts } from "@/lib/integrations/google/people";
import { isGoogleConfigured } from "@/lib/integrations/google/oauth";
import { isAppEditor } from "@/lib/org";
import { buildRawMessage } from "@/lib/reminders/mime";
import { sendViaGmail } from "@/lib/reminders/gmail";
import { zonedTimeToUtc } from "@/lib/schedule/recurrence";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { automationValues, renderAutomation } from "./render";
import { showDateAfter } from "./schedule";
import { RECENT_LOG_LIMIT, reminderState } from "./state";
import {
  DEFAULT_SCHEDULING_AUTOMATION,
  parseAutomationInput,
  type AutomationInput,
} from "./validate";

/**
 * The dashboard side of the owner's Scheduling automations.
 *
 * Every route under src/app/api/apps/[appId]/automation is a thin wrapper over this file. Authorization is done with
 * the signed-in user's own client; the automation tables themselves are service-role only, so every read and write
 * after that point goes through the admin client and is filtered by `app_id`.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_REMINDERS = 10;
const MAX_CUSTOMERS = 1000;
const PAST_ERROR = "That date and time have already passed.";
const NOT_FOUND = "Reminder not found";
const GMAIL_FAILED = "Gmail wouldn't send it. Try again in a minute.";
const GMAIL_FORBIDDEN =
  "Gmail says this account isn't allowed to send. Connect again and keep every box ticked.";
const NO_PERMISSION =
  "Google didn't give permission to read contacts. Connect again and keep every box ticked.";

const NOT_AUTHENTICATED = "Not authenticated";
const NOT_AUTHORIZED = "Not authorized";
const APP_NOT_FOUND = "Not found";
const SCHEDULING_OFF = "Scheduling isn't turned on for this app yet.";

export interface SchedulingCallerOk {
  ok: true;
  /** The signed-in user's client, for reads RLS already scopes to their organization. */
  supabase: SupabaseClient<Database>;
  user: { id: string; email: string | null };
  appName: string;
  timeZone: string;
}

export type SchedulingCallerResult =
  | SchedulingCallerOk
  | { ok: false; response: Response };

export interface SchedulingCallerFacts {
  hasUser: boolean;
  isEditor: boolean;
  app: { name: string } | null;
  settings: { time_zone: string } | null;
}

export type SchedulingCallerDecision =
  | { ok: true; appName: string; timeZone: string }
  | { ok: false; status: 400 | 401 | 403 | 404; error: string };

/**
 * The refusal order (signed in, editor, app exists, Scheduling on) in one pure place. `schedulingCaller` reads the
 * facts, but the statuses and messages the routes answer with come from here.
 */
export function decideSchedulingCaller(
  facts: SchedulingCallerFacts
): SchedulingCallerDecision {
  if (!facts.hasUser) return { ok: false, status: 401, error: NOT_AUTHENTICATED };
  if (!facts.isEditor) return { ok: false, status: 403, error: NOT_AUTHORIZED };
  if (!facts.app) return { ok: false, status: 404, error: APP_NOT_FOUND };
  if (!facts.settings) {
    return { ok: false, status: 400, error: SCHEDULING_OFF };
  }
  return { ok: true, appName: facts.app.name, timeZone: facts.settings.time_zone };
}

function refuse(error: string, status: number): SchedulingCallerResult {
  return { ok: false, response: Response.json({ error }, { status }) };
}

/**
 * Who may manage one app's Scheduling automations: a signed-in TapAndLaunch editor of the app's organization, for an
 * app that has Scheduling turned on. The app's name and time zone come from the same RLS-scoped client, never from
 * the request.
 */
export async function schedulingCaller(appId: string): Promise<SchedulingCallerResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return refuse(NOT_AUTHENTICATED, 401);

  const isEditor = await isAppEditor(supabase, appId);

  let app: { name: string } | null = null;
  let settings: { time_zone: string } | null = null;
  if (isEditor) {
    const [appResult, settingsResult] = await Promise.all([
      supabase.from("apps").select("name").eq("id", appId).maybeSingle(),
      supabase
        .from("schedule_settings")
        .select("time_zone")
        .eq("app_id", appId)
        .maybeSingle(),
    ]);
    app = appResult.data ?? null;
    settings = settingsResult.data ?? null;
  }

  const decision = decideSchedulingCaller({
    hasUser: true,
    isEditor,
    app,
    settings,
  });
  if (!decision.ok) {
    return refuse(decision.error, decision.status);
  }

  return {
    ok: true,
    supabase,
    user: { id: user.id, email: user.email ?? null },
    appName: decision.appName,
    timeZone: decision.timeZone,
  };
}

type ExistingReminder = Pick<
  AutomationReminderRow,
  "id" | "enabled" | "schedule_kind" | "weekday" | "once_date" | "send_time" | "time_zone"
>;

/** PostgREST returns times as "HH:MM:SS"; the screen sends "HH:MM". Compare them in one form. */
export function shortTime(value: string): string {
  return value.slice(0, 5);
}

/** The instant of a one-off reminder, or null when its date or time zone can't be read. */
export function onceInstant(
  input: { once_date: string | null; send_time: string },
  timeZone: string
): Date | null {
  try {
    return zonedTimeToUtc(input.once_date ?? "", input.send_time, timeZone);
  } catch {
    return null;
  }
}

/** True when saving `input` would move an existing reminder's schedule (not just its wording or recipients). */
export function reminderScheduleChanged(
  existing: Pick<
    AutomationReminderRow,
    "schedule_kind" | "weekday" | "once_date" | "send_time" | "time_zone"
  >,
  input: Pick<AutomationInput, "schedule_kind" | "weekday" | "once_date" | "send_time">,
  timeZone: string
): boolean {
  return (
    existing.schedule_kind !== input.schedule_kind ||
    (existing.weekday ?? null) !== (input.weekday ?? null) ||
    (existing.once_date ?? null) !== (input.once_date ?? null) ||
    shortTime(existing.send_time) !== shortTime(input.send_time) ||
    existing.time_zone !== timeZone
  );
}

/**
 * The values a test send renders with: a made-up recipient and the app's own name as the business. The date follows
 * the sender's rule for an app with no open-mic block, so the preview matches what recipients will get.
 */
export function schedulingSampleValues(
  business: string,
  now: Date,
  timeZone: string
): Record<string, string> {
  return automationValues({
    name: "Alex Morgan",
    showName: business,
    showDate: showDateAfter(now, 5, timeZone),
    showTime: null,
    venue: null,
  });
}

export interface SchedulingCustomer {
  id: string;
  name: string;
  email: string;
}

/** The app's Scheduling customers that can be picked as recipients: one entry per row that has an address. */
export function customerRecipients(
  rows: { id: string; name: string; email: string | null }[]
): SchedulingCustomer[] {
  const customers: SchedulingCustomer[] = [];
  for (const row of rows) {
    const email = row.email?.trim() ?? "";
    if (!email) continue;
    customers.push({ id: row.id, name: row.name, email });
  }
  return customers;
}

function serverError(message: string): Response {
  return Response.json({ error: message }, { status: 500 });
}

/** Everything the dashboard's Automation screen shows, plus the Scheduling customers it can pick from. */
export async function loadSchedulingState(
  appId: string,
  caller: SchedulingCallerOk
): Promise<Response> {
  const admin = createAdminClient();
  const [gmail, reminderRowsResult, recipientRowsResult, customerRowsResult] =
    await Promise.all([
      getConnectionStatus(appId),
      admin
        .from("automation_reminders")
        .select(
          "id, name, enabled, schedule_kind, weekday, once_date, send_time, time_zone, subject, body"
        )
        .eq("app_id", appId)
        .order("created_at", { ascending: true }),
      admin
        .from("automation_recipients")
        .select("reminder_id, name, email")
        .eq("app_id", appId)
        .order("created_at", { ascending: true }),
      admin
        .from("schedule_customers")
        .select("id, name, email")
        .eq("app_id", appId)
        .not("email", "is", null)
        .order("name", { ascending: true })
        .limit(MAX_CUSTOMERS),
    ]);

  if (reminderRowsResult.error) {
    console.error(
      "Scheduling automation could not read reminders",
      appId,
      "reminders_failed"
    );
    return serverError("Could not load the reminders.");
  }
  if (recipientRowsResult.error) {
    console.error(
      "Scheduling automation could not read recipients",
      appId,
      "recipients_failed"
    );
    return serverError("Could not load the reminders.");
  }
  if (customerRowsResult.error) {
    console.error(
      "Scheduling automation could not read customers",
      appId,
      "customers_failed"
    );
    return serverError("Could not load the customers.");
  }

  const recipientsByReminder = new Map<
    string,
    { name: string | null; email: string }[]
  >();
  for (const recipient of recipientRowsResult.data ?? []) {
    const list = recipientsByReminder.get(recipient.reminder_id) ?? [];
    list.push({ name: recipient.name, email: recipient.email });
    recipientsByReminder.set(recipient.reminder_id, list);
  }

  const rows = reminderRowsResult.data ?? [];
  const logs = await Promise.all(
    rows.map((row) =>
      admin
        .from("automation_send_log")
        .select("occurrence_at, status")
        .eq("app_id", appId)
        .eq("reminder_id", row.id)
        .order("occurrence_at", { ascending: false })
        .limit(RECENT_LOG_LIMIT)
    )
  );
  if (logs.some((log) => log.error)) {
    console.error(
      "Scheduling automation could not read the send log",
      appId,
      "log_failed"
    );
    return serverError("Could not load the reminders.");
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
    showName: caller.appName,
    timeZone: caller.timeZone,
    reminders,
    defaults: DEFAULT_SCHEDULING_AUTOMATION,
    customers: customerRecipients(customerRowsResult.data ?? []),
  });
}

/** The owner's Google contacts for the recipient picker, read from the app's connected account. */
export async function loadSchedulingContacts(appId: string): Promise<Response> {
  const token = await getAccessToken(appId);
  if (!token.ok) {
    if (token.reason === "not_connected") {
      return Response.json({ error: "Connect Gmail first." }, { status: 409 });
    }
    if (token.reason === "reconnect") {
      return Response.json(
        { error: "Your Gmail connection ended. Connect again." },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "Gmail isn't available right now. Try again." },
      { status: 503 }
    );
  }

  // The saved scopes already know whether contacts were granted; asking Google would only repeat that. Either list
  // is enough: the owner may have granted only one, and listContacts() returns whichever it can read.
  const gmail = await getConnectionStatus(appId);
  if (!gmail.canReadContacts && !gmail.canReadOtherContacts) {
    return Response.json({ error: NO_PERMISSION }, { status: 403 });
  }

  const result = await listContacts(token.accessToken);
  if (!result.ok) {
    if (result.reason === "no_permission") {
      return Response.json({ error: NO_PERMISSION }, { status: 403 });
    }
    return Response.json(
      { error: "Couldn't load your contacts. Try again." },
      { status: 502 }
    );
  }

  return Response.json({ contacts: result.contacts });
}

/**
 * Creates or updates one reminder and replaces its recipient list. A save never touches `enabled`; the only time
 * `activated_at` moves is when an enabled reminder's schedule changes, so an edit can't make a moment that already
 * passed suddenly send. The app's Scheduling time zone is authoritative for every reminder it holds.
 */
export async function saveSchedulingReminder(
  appId: string,
  caller: SchedulingCallerOk,
  request: Request
): Promise<Response> {
  const parsed = parseAutomationInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const input = parsed.value;

  const admin = createAdminClient();
  const now = new Date();
  const timeZone = caller.timeZone;

  let existing: ExistingReminder | null = null;
  if (input.id) {
    const { data, error } = await admin
      .from("automation_reminders")
      .select("id, enabled, schedule_kind, weekday, once_date, send_time, time_zone")
      .eq("id", input.id)
      .eq("app_id", appId)
      .maybeSingle();
    if (error) {
      console.error(
        "Scheduling automation save could not read the reminder",
        appId,
        "reminder_read_failed"
      );
      return serverError("Could not load the reminder.");
    }
    if (!data) return Response.json({ error: NOT_FOUND }, { status: 404 });
    existing = data;
  } else {
    const { count, error } = await admin
      .from("automation_reminders")
      .select("id", { count: "exact", head: true })
      .eq("app_id", appId);
    if (error) {
      console.error(
        "Scheduling automation save could not count reminders",
        appId,
        "count_failed"
      );
      return serverError("Could not save the reminder. Try again.");
    }
    if ((count ?? 0) >= MAX_REMINDERS) {
      return Response.json(
        { error: "You can keep up to 10 reminders." },
        { status: 400 }
      );
    }
  }

  if (input.schedule_kind === "once") {
    const onceAt = onceInstant(
      { once_date: input.once_date, send_time: input.send_time },
      timeZone
    );
    if (!onceAt || onceAt.getTime() <= now.getTime()) {
      return Response.json({ error: PAST_ERROR }, { status: 400 });
    }
  }

  let reminderId: string;
  if (existing) {
    const scheduleChanged = reminderScheduleChanged(existing, input, timeZone);

    const { error } = await admin
      .from("automation_reminders")
      .update({
        name: input.name,
        schedule_kind: input.schedule_kind,
        weekday: input.weekday,
        once_date: input.once_date,
        send_time: input.send_time,
        time_zone: timeZone,
        subject: input.subject,
        body: input.body,
        ...(existing.enabled && scheduleChanged
          ? { activated_at: now.toISOString() }
          : {}),
      })
      .eq("id", existing.id)
      .eq("app_id", appId);
    if (error) {
      console.error(
        "Scheduling automation save could not update the reminder",
        appId,
        "reminder_update_failed"
      );
      return serverError("Could not save the reminder. Try again.");
    }
    reminderId = existing.id;
  } else {
    const { data, error } = await admin
      .from("automation_reminders")
      .insert({
        app_id: appId,
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
      console.error(
        "Scheduling automation save could not insert the reminder",
        appId,
        "reminder_insert_failed"
      );
      return serverError("Could not save the reminder. Try again.");
    }
    reminderId = data.id;
  }

  // Replace the list exactly: drop the addresses the caller removed, upsert the rest (keeping a kept row's created_at).
  const { data: currentRecipients, error: recipientsReadError } = await admin
    .from("automation_recipients")
    .select("id, email")
    .eq("reminder_id", reminderId)
    .eq("app_id", appId);
  if (recipientsReadError) {
    console.error(
      "Scheduling automation save could not read recipients",
      appId,
      "recipients_read_failed"
    );
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
      .eq("app_id", appId);
    if (error) {
      console.error(
        "Scheduling automation save could not delete recipients",
        appId,
        "recipients_delete_failed"
      );
      return serverError("Could not save the reminder. Try again.");
    }
  }

  if (input.recipients.length > 0) {
    const { error } = await admin.from("automation_recipients").upsert(
      input.recipients.map((recipient) => ({
        reminder_id: reminderId,
        app_id: appId,
        name: recipient.name,
        email: recipient.email,
      })),
      { onConflict: "reminder_id,email" }
    );
    if (error) {
      console.error(
        "Scheduling automation save could not save recipients",
        appId,
        "recipients_upsert_failed"
      );
      return serverError("Could not save the reminder. Try again.");
    }
  }

  const { data: log, error: logError } = await admin
    .from("automation_send_log")
    .select("occurrence_at, status")
    .eq("app_id", appId)
    .eq("reminder_id", reminderId)
    .order("occurrence_at", { ascending: false })
    .limit(RECENT_LOG_LIMIT);
  if (logError) {
    console.error(
      "Scheduling automation save could not read the send log",
      appId,
      "log_failed"
    );
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
export async function deleteSchedulingReminder(
  appId: string,
  request: Request
): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_PATTERN.test(id)) {
    return Response.json({ error: NOT_FOUND }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("automation_reminders")
    .delete()
    .eq("id", id)
    .eq("app_id", appId)
    .select("id");
  if (error) {
    console.error("Scheduling automation delete failed", appId, "reminder_delete_failed");
    return serverError("Could not delete the reminder. Try again.");
  }
  if (!data || data.length === 0) {
    return Response.json({ error: NOT_FOUND }, { status: 404 });
  }

  return Response.json({ ok: true });
}

/**
 * Switches one reminder on or off. Turning on is refused unless Gmail can still send, there is someone to send to,
 * and a one-off moment has not already passed. Switching on sets `activated_at` to now, so only a later occurrence
 * can ever go out.
 */
export async function setSchedulingReminderEnabled(
  appId: string,
  request: Request
): Promise<Response> {
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
    .eq("app_id", appId)
    .maybeSingle();
  if (error) {
    console.error(
      "Scheduling automation switch could not read the reminder",
      appId,
      "reminder_read_failed"
    );
    return serverError("Could not change the reminder. Try again.");
  }
  if (!reminder) return Response.json({ error: NOT_FOUND }, { status: 404 });

  const now = new Date();

  if (enabled) {
    const gmail = await getConnectionStatus(appId);
    if (!gmail.connected || !gmail.canSend || gmail.needsReconnect) {
      return Response.json({ error: "Connect Gmail first." }, { status: 400 });
    }

    const { count, error: countError } = await admin
      .from("automation_recipients")
      .select("id", { count: "exact", head: true })
      .eq("reminder_id", reminder.id)
      .eq("app_id", appId);
    if (countError) {
      console.error(
        "Scheduling automation switch could not count recipients",
        appId,
        "count_failed"
      );
      return serverError("Could not change the reminder. Try again.");
    }
    if ((count ?? 0) === 0) {
      return Response.json(
        { error: "Add at least one person first." },
        { status: 400 }
      );
    }

    if (reminder.schedule_kind === "once") {
      const onceAt = onceInstant(reminder, reminder.time_zone);
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
    .eq("app_id", appId);
  if (updateError) {
    console.error(
      "Scheduling automation switch could not update the reminder",
      appId,
      "update_failed"
    );
    return serverError("Could not change the reminder. Try again.");
  }

  return Response.json({ enabled });
}

/**
 * Sends the SAVED reminder to the connected Gmail address itself, with sample values, so the owner can see what
 * recipients will get. The only thing read from the request is the reminder's id: the sender and recipient are
 * always the connected address.
 */
export async function sendSchedulingTestEmail(
  appId: string,
  caller: SchedulingCallerOk,
  request: Request
): Promise<Response> {
  const raw: unknown = await request.json().catch(() => null);
  const id =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).id
      : undefined;
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reminder, error } = await admin
    .from("automation_reminders")
    .select("id, subject, body")
    .eq("id", id)
    .eq("app_id", appId)
    .maybeSingle();
  if (error) {
    console.error(
      "Scheduling automation test could not read the reminder",
      appId,
      "reminder_read_failed"
    );
    return serverError("Could not load the reminder.");
  }
  if (!reminder) return Response.json({ error: NOT_FOUND }, { status: 404 });

  const token = await getAccessToken(appId);
  if (!token.ok) {
    if (token.reason === "not_connected") {
      return Response.json({ error: "Connect Gmail first." }, { status: 409 });
    }
    if (token.reason === "reconnect") {
      return Response.json(
        { error: "Your Gmail connection ended. Connect again." },
        { status: 409 }
      );
    }
    return Response.json(
      { error: "Gmail isn't available right now. Try again." },
      { status: 503 }
    );
  }

  const rendered = renderAutomation(
    { subject: reminder.subject, body: reminder.body },
    schedulingSampleValues(caller.appName, new Date(), caller.timeZone)
  );

  let message: string;
  try {
    message = buildRawMessage({
      fromName: caller.appName,
      fromEmail: token.email,
      // Only ever the connected address, never anything from the request.
      to: token.email,
      subject: `[Test] ${rendered.subject}`,
      text: rendered.text,
      html: rendered.html,
    });
  } catch {
    return Response.json({ error: GMAIL_FAILED }, { status: 502 });
  }

  const sent = await sendViaGmail(token.accessToken, message);
  if (!sent.ok) {
    return Response.json(
      { error: sent.status === 403 ? GMAIL_FORBIDDEN : GMAIL_FAILED },
      { status: 502 }
    );
  }

  return Response.json({ ok: true, to: token.email });
}
