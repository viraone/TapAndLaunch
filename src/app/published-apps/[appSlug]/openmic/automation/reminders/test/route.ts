import { automationCaller } from "@/lib/automation/auth";
import { openMicConfigFor } from "@/lib/automation/config";
import { automationValues, renderAutomation } from "@/lib/automation/render";
import { showDateAfter } from "@/lib/automation/schedule";
import { getAccessToken } from "@/lib/integrations/google/connection";
import { sendViaGmail } from "@/lib/reminders/gmail";
import { buildRawMessage } from "@/lib/reminders/mime";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_TIME_ZONE = "America/Los_Angeles";
const GMAIL_FAILED = "Gmail wouldn't send it. Try again in a minute.";
const GMAIL_FORBIDDEN =
  "Gmail says this account isn't allowed to send. Connect again and keep every box ticked.";

/**
 * Sends the SAVED reminder to the connected Gmail address itself, with sample values, so the owner can see what
 * recipients will get. The only thing read from the request is the reminder's id: the sender and recipient are always
 * the connected address.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ appSlug: string }> }
) {
  const { appSlug } = await context.params;
  const caller = await automationCaller(appSlug, request);
  if (!caller.ok) return caller.response;

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
    .eq("app_id", caller.appId)
    .maybeSingle();
  if (error) {
    console.error("Automation test could not read the reminder", caller.appId, "reminder_read_failed");
    return Response.json({ error: "Could not load the reminder." }, { status: 500 });
  }
  if (!reminder) return Response.json({ error: "Reminder not found" }, { status: 404 });

  const token = await getAccessToken(caller.appId);
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

  const config = await openMicConfigFor(caller.appId);
  const showName = config?.show_name ?? caller.appName;
  const showWeekday = config?.opens_weekday ?? 5;
  const timeZone = config?.time_zone ?? DEFAULT_TIME_ZONE;
  const showDate = showDateAfter(new Date(), showWeekday, timeZone);

  const values = automationValues({
    name: "Alex Morgan",
    showName,
    showDate,
    showTime: config?.show_time ?? null,
    venue: config?.venue ?? null,
  });
  const rendered = renderAutomation(
    { subject: reminder.subject, body: reminder.body },
    values
  );

  let message: string;
  try {
    message = buildRawMessage({
      fromName: showName,
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
