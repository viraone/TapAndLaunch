import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { isPushConfigured, sendPush } from "@/lib/notifications/push";
import { isEmailConfigured, sendEmailBatch } from "@/lib/notifications/email";
import { fromHeader, renderEmailHtml, signUnsubscribe } from "@/lib/notifications/email-content";
import { appOrigin } from "@/lib/stripe/checkout";
import { getRootDomain } from "@/lib/tenant";
import { isSmsConfigured, sendSms } from "@/lib/notifications/sms";
import { resolveEmailRecipients, resolvePushRecipients, resolveSmsRecipients } from "@/lib/notifications/recipients";
import { recordAnalyticsEvent } from "@/lib/pwa/analytics";
import type { AnalyticsEventType, NotificationChannel } from "@/types/database";

const TargetSchema = z.union([
  z.object({ type: z.literal("all") }),
  z.object({ type: z.literal("tier"), tier: z.string().min(1) }),
]);

const SendSchema = z.object({
  channel: z.enum(["push", "email", "sms"]),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000),
  url: z.string().optional(),
  target: TargetSchema,
});

const EVENT_TYPE_FOR_CHANNEL: Record<NotificationChannel, AnalyticsEventType> = {
  push: "push_sent",
  email: "email_sent",
  sms: "sms_sent",
};

/**
 * Sends a notification to a target audience over one channel. Dispatches
 * to every recipient synchronously within the request (`Promise.allSettled`)
 * rather than through a queue/background job — fine at the recipient counts
 * a scaffold deals with, not something to keep doing at real scale (a slow
 * or hanging provider call would hold the request open for everyone in the
 * batch).
 */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  if (!(await isAppEditor(supabase, appId))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = SendSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { channel, title, body, url, target } = parsed.data;

  if (channel === "push" && !isPushConfigured()) {
    return Response.json({ error: "Push notifications are not configured on this server" }, { status: 400 });
  }
  if (channel === "email" && !isEmailConfigured()) {
    return Response.json({ error: "Email is not configured on this server" }, { status: 400 });
  }
  if (channel === "sms" && !isSmsConfigured()) {
    return Response.json({ error: "SMS is not configured on this server" }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;

  if (channel === "push") {
    const recipients = await resolvePushRecipients(appId, target);
    const admin = createAdminClient();
    const results = await Promise.allSettled(
      recipients.map((r) => sendPush({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }, { title, body, url }))
    );
    await Promise.all(
      results.map(async (result, i) => {
        if (result.status === "fulfilled" && result.value.ok) {
          sent++;
        } else {
          failed++;
          const stale = result.status === "fulfilled" && !result.value.ok && result.value.stale;
          if (stale) {
            await admin.from("push_subscriptions").delete().eq("id", recipients[i].subscriptionId);
          }
        }
      })
    );
  } else if (channel === "email") {
    const recipients = await resolveEmailRecipients(appId, target);
    const { data: app } = await createAdminClient().from("apps").select("name, slug").eq("id", appId).single();
    const secret = process.env.MEMBER_SESSION_SECRET;
    if (!app || !secret) return Response.json({ error: "Email is not set up correctly on this server" }, { status: 500 });

    // Every email carries its own unsubscribe link (also as the one-click header mail apps look for).
    const origin = appOrigin(app.slug, getRootDomain());
    const emails = recipients.map((r) => {
      const unsubscribeUrl = `${origin}/unsubscribe?m=${r.memberId}&t=${signUnsubscribe(r.memberId, secret)}`;
      return {
        to: r.email,
        subject: title,
        html: renderEmailHtml({ appName: app.name, title, body, unsubscribeUrl }),
        headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    });
    const result = await sendEmailBatch(fromHeader(app.name, process.env.RESEND_FROM_EMAIL ?? ""), emails);
    sent = result.sent;
    failed = result.failed;
  } else {
    const recipients = await resolveSmsRecipients(appId, target);
    const text = `${title}: ${body}`;
    const results = await Promise.allSettled(recipients.map((r) => sendSms(r.phone, text)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.ok) sent++;
      else failed++;
    }
  }

  await recordAnalyticsEvent({
    appId,
    eventType: EVENT_TYPE_FOR_CHANNEL[channel],
    metadata: { title, target, sent, failed },
  });

  return Response.json({ sent, failed, total: sent + failed });
}
