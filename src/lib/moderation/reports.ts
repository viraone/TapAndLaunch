import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppReportReason, Database } from "@/types/database";
import { fromHeader, escapeHtml } from "@/lib/notifications/email-content";
import { isEmailConfigured, sendEmailBatch } from "@/lib/notifications/email";
import { siteOrigin } from "@/lib/site";
import { REPORT_REASON_LABELS } from "./labels";

type Admin = SupabaseClient<Database>;

/** How many reports one person may send in an hour, across all apps (to stop floods). */
export const REPORTS_PER_HOUR = 5;

/**
 * A one-way hash of the reporter's network address, kept only to limit how often one person can report. The address
 * itself is never stored. Salted with a server secret so the hash can't be matched back to an address.
 */
export function reporterHash(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.MEMBER_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`report:${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** The visitor's address as Vercel passes it on (the first entry of x-forwarded-for). */
export function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
}

/** The email addresses of TapAndLaunch's platform admins, who handle reports. */
async function adminEmails(admin: Admin): Promise<string[]> {
  const { data } = await admin.from("platform_admins").select("user_id");
  const emails: string[] = [];
  for (const row of data ?? []) {
    const { data: user } = await admin.auth.admin.getUserById(row.user_id as string);
    if (user.user?.email) emails.push(user.user.email);
  }
  return emails;
}

/** Tells the platform admins about a new report, with a link to review it. Never throws: a report is saved either way. */
export async function notifyAdmins(admin: Admin, input: { appName: string; slug: string; liveUrl: string; reason: AppReportReason; details: string | null; contact: string | null; openReports: number }): Promise<void> {
  try {
    if (!isEmailConfigured()) return;
    const to = await adminEmails(admin);
    if (to.length === 0) return;
    const review = `${siteOrigin()}/dashboard/admin#reports`;
    const html = `<div style="font:15px/1.5 system-ui,sans-serif;color:#0f172a;max-width:560px">
<p style="margin:0 0 12px"><b>${escapeHtml(input.appName)}</b> was reported: <b>${escapeHtml(REPORT_REASON_LABELS[input.reason])}</b>.</p>
${input.details ? `<p style="margin:0 0 12px;padding:12px;background:#f1f5f9;border-radius:8px;white-space:pre-wrap">${escapeHtml(input.details)}</p>` : ""}
${input.contact ? `<p style="margin:0 0 12px">Reporter's contact: ${escapeHtml(input.contact)}</p>` : ""}
<p style="margin:0 0 12px">Open reports for this app: ${input.openReports}. App: <a href="${escapeHtml(input.liveUrl)}">${escapeHtml(input.liveUrl)}</a></p>
<p style="margin:0"><a href="${review}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#fff;border-radius:999px;text-decoration:none">Review and take down</a></p>
</div>`;
    await sendEmailBatch(
      fromHeader("TapAndLaunch", process.env.RESEND_FROM_EMAIL as string),
      to.map((address) => ({ to: address, subject: `Report: ${input.appName} (${REPORT_REASON_LABELS[input.reason]})`, html }))
    );
  } catch (error) {
    console.error("report email failed:", error);
  }
}
