import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured, sendPush } from "@/lib/notifications/push";
import { resolvePushRecipients } from "@/lib/notifications/recipients";
import { isJobAuthorized, OWNER_TIER } from "@/lib/food/jobReport";

const ReportSchema = z.object({
  appId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(400),
});

/**
 * The daily LiveBites job (tools/menu-ingest, on the owner's Mac) tells the owner how the run went. Only that job can call
 * this (it presents the service key it already holds), and the message goes only to members of the private "owner" tier,
 * never to the app's visitors. Nothing here reads or writes restaurant data.
 */
export async function POST(request: Request) {
  if (!isJobAuthorized(request.headers.get("authorization"), process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return Response.json({ error: "Not authorized" }, { status: 401 });
  }
  const parsed = ReportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  if (!isPushConfigured()) return Response.json({ error: "Push notifications are not configured on this server" }, { status: 400 });

  const { appId, title, body } = parsed.data;
  const recipients = await resolvePushRecipients(appId, { type: "tier", tier: OWNER_TIER });
  const admin = createAdminClient();
  let sent = 0;
  let failed = 0;
  await Promise.all(
    recipients.map(async (r) => {
      const result = await sendPush({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }, { title, body, url: "/" });
      if (result.ok) sent++;
      else {
        failed++;
        if (result.stale) await admin.from("push_subscriptions").delete().eq("id", r.subscriptionId);
      }
    })
  );
  return Response.json({ sent, failed, devices: recipients.length });
}
