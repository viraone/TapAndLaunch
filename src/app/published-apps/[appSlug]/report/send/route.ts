import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, notifyAdmins, reporterHash, REPORTS_PER_HOUR } from "@/lib/moderation/reports";
import { REPORT_REASONS } from "@/lib/moderation/labels";

const Schema = z.object({
  reason: z.enum(REPORT_REASONS as [string, ...string[]]),
  details: z.string().trim().max(2000).optional().default(""),
  contact: z.string().trim().max(200).optional().default(""),
});

/**
 * A visitor reports this published app. Anyone can, without an account; one person can send a few an hour. The report
 * is saved for TapAndLaunch to review and the platform admins get an email.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "This app isn't available." }, { status: 404 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose what's wrong with the app." }, { status: 400 });

  const admin = createAdminClient();
  const hash = reporterHash(clientIp(request));
  if (hash) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin.from("app_reports").select("id", { count: "exact", head: true }).eq("reporter_hash", hash).gte("created_at", since);
    if ((count ?? 0) >= REPORTS_PER_HOUR) return Response.json({ error: "Thanks, we already have your reports. Try again later if you need to." }, { status: 429 });
  }

  const { app } = published;
  const reason = parsed.data.reason as (typeof REPORT_REASONS)[number];
  const { error } = await admin.from("app_reports").insert({ app_id: app.id, reason, details: parsed.data.details || null, contact: parsed.data.contact || null, reporter_hash: hash });
  if (error) return Response.json({ error: "Couldn't send the report. Try again." }, { status: 500 });

  const { count: open } = await admin.from("app_reports").select("id", { count: "exact", head: true }).eq("app_id", app.id).is("resolved_at", null);
  const liveUrl = new URL(request.url).origin;
  await notifyAdmins(admin, { appName: app.name, slug: app.slug, liveUrl, reason, details: parsed.data.details || null, contact: parsed.data.contact || null, openReports: open ?? 1 });
  return Response.json({ ok: true });
}
