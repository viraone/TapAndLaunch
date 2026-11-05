import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { getAccessToken } from "@/lib/integrations/google/connection";
import { addDays, localDateOf, zonedTimeToUtc } from "@/lib/schedule/recurrence";
import { DEFAULT_REMINDER, reminderValues, renderReminder } from "@/lib/reminders/render";
import { buildRawMessage } from "@/lib/reminders/mime";
import { sendViaGmail } from "@/lib/reminders/gmail";

const GMAIL_FAILED = "Gmail wouldn't send it. Try again in a minute.";
const GMAIL_FORBIDDEN =
  "Gmail says this account isn't allowed to send. Connect again and keep every box ticked.";

/**
 * Sends the SAVED reminder to the connected Gmail address itself, so the owner can see it in their inbox.
 * The request body is deliberately ignored: a recipient can never come from the caller.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!(await isAppEditor(supabase, appId))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: schedule } = await supabase
    .from("schedule_settings")
    .select("time_zone")
    .eq("app_id", appId)
    .maybeSingle();

  if (!schedule) {
    return Response.json(
      { error: "Scheduling isn't turned on for this app yet." },
      { status: 400 }
    );
  }

  const [{ data: app }, { data: saved }] = await Promise.all([
    supabase.from("apps").select("name").eq("id", appId).maybeSingle(),
    supabase
      .from("reminder_settings")
      .select("subject, body, prep_note")
      .eq("app_id", appId)
      .maybeSingle(),
  ]);

  const settings = saved ?? DEFAULT_REMINDER;
  const business = app?.name ?? "Your business";
  const timeZone = schedule.time_zone;

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

  // The sample visit is always tomorrow at 10:00 where the business is.
  const sampleDate = addDays(localDateOf(new Date(), timeZone), 1);
  const startsAt = zonedTimeToUtc(sampleDate, "10:00", timeZone);

  const values = reminderValues({
    name: "Alex Morgan",
    address: "123 Example Street",
    service: "Standard clean",
    business,
    startsAt,
    timeZone,
  });
  const rendered = renderReminder(settings, values);

  let raw: string;
  try {
    raw = buildRawMessage({
      fromName: business,
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

  const sent = await sendViaGmail(token.accessToken, raw);
  if (!sent.ok) {
    return Response.json(
      { error: sent.status === 403 ? GMAIL_FORBIDDEN : GMAIL_FAILED },
      { status: 502 }
    );
  }

  return Response.json({ ok: true, to: token.email });
}
