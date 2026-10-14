import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAsker } from "@/lib/ai/ask";
import { describeSite, loadSite } from "@/lib/ai/site-context";
import { extractUpdate } from "@/lib/ai/inbox";
import { applyExtraction } from "@/lib/ai/inbox-apply";
import { isEditorRole } from "@/lib/org";
import { isEmailConfigured, sendEmailBatch } from "@/lib/notifications/email";
import { SAMPLE_TIME_ZONE } from "@/lib/apps/sample-events";
import { formatDayTimeRange } from "@/lib/format-date";
import { getRootDomain } from "@/lib/tenant";

/**
 * Forward an email, update the site. An inbound-email service (Resend's inbound webhooks, or any that posts JSON)
 * calls this with the message. The sender must be a signed-up editor of exactly one organization; the email's words
 * go through the same paste inbox as Quick updates, against that organization's one live site (or its only site),
 * and the sender gets a short reply saying what landed. Protected by a shared secret in the `x-inbound-secret`
 * header (`INBOUND_EMAIL_SECRET`), so nobody else can post here.
 *
 * Accepts Resend's `email.received` shape and a plain {from, subject, text} body.
 */
const Resend = z.object({
  type: z.string().optional(),
  data: z.object({ from: z.string(), subject: z.string().optional(), text: z.string().optional(), html: z.string().optional() }).optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
});

export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret || request.headers.get("x-inbound-secret") !== secret) return Response.json({ error: "Not allowed" }, { status: 401 });

  const parsed = Resend.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Unreadable message" }, { status: 400 });
  const m = parsed.data.data ?? parsed.data;
  const from = /<([^>]+)>/.exec(m.from ?? "")?.[1] ?? (m.from ?? "").trim();
  const text = (m.text ?? stripHtml(m.html ?? "")).trim();
  if (!from || !text) return Response.json({ error: "No sender or no words" }, { status: 400 });

  const admin = createAdminClient();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = users?.users.find((u) => u.email?.toLowerCase() === from.toLowerCase());
  if (!user) return Response.json({ ok: false, reason: "unknown sender" });

  const { data: memberships } = await admin.from("memberships").select("organization_id, role").eq("user_id", user.id);
  const orgIds = (memberships ?? []).filter((x) => isEditorRole(x.role)).map((x) => x.organization_id);
  if (orgIds.length === 0) return Response.json({ ok: false, reason: "not an editor" });

  // The site this is about: the sender's one live site, else their only site.
  const { data: apps } = await admin.from("apps").select("id, name, status, organization_id").in("organization_id", orgIds).is("deleted_at", null).neq("kind", "code");
  const live = (apps ?? []).filter((a) => a.status === "published");
  const target = live.length === 1 ? live[0] : (apps ?? []).length === 1 ? (apps ?? [])[0] : null;
  if (!target) return reply(from, m.subject, "I couldn't tell which site this is for. Paste it on the site's Quick updates page instead.", []);

  const asker = await resolveAsker(admin, target.organization_id);
  if (!asker) return reply(from, m.subject, "AI isn't switched on for your account yet, so nothing changed.", []);

  // Writes as the service role, scoped to the one app we chose for this verified sender.
  const site = await loadSite(admin, target.id);
  if (!site) return Response.json({ ok: false, reason: "site missing" });

  await admin.from("ai_generations").insert({ user_id: user.id, organization_id: target.organization_id, kind: "inbox", details: { app_id: target.id, source: asker.source, via: "email" } });
  const subject = m.subject ? `Subject: ${m.subject}\n\n` : "";
  let found;
  try {
    found = await extractUpdate({ site: describeSite(site), text: `${subject}${text}`, timeZone: SAMPLE_TIME_ZONE, ask: asker.ask });
  } catch {
    return reply(from, m.subject, "The AI couldn't read that one. Try again, or paste it on the Quick updates page.", []);
  }
  if (!found) return reply(from, m.subject, "I couldn't make sense of that email, so nothing changed.", []);
  const outcome = await applyExtraction(admin, site, found);

  const lines = [
    ...outcome.events.map((e) => `Added to the calendar: ${e.title}, ${formatDayTimeRange(new Date(e.starts_at), null)}${e.location ? `, ${e.location}` : ""}`),
    ...(outcome.announcement ? [`Across the top of every page: "${outcome.announcement.after}"`] : []),
    ...outcome.sections.map((s) => `Changed a section on the ${s.page} page`),
    ...outcome.questions.map((q) => `Couldn't do: ${q}`),
  ];
  return reply(from, m.subject, lines.length ? outcome.summary : `${outcome.summary} Nothing on the site needed to change.`, lines, target.id);
}

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n");
}

async function reply(to: string, subject: string | undefined, summary: string, lines: string[], appId?: string) {
  const html = `<p>${escape(summary)}</p>${lines.length ? `<ul>${lines.map((l) => `<li>${escape(l)}</li>`).join("")}</ul>` : ""}${appId ? `<p>To undo or change any of it: <a href="${dashboardOrigin()}/dashboard/apps/${appId}/updates">Quick updates</a>.</p>` : ""}`;
  if (isEmailConfigured()) await sendEmailBatch(process.env.RESEND_FROM_EMAIL as string, [{ to, subject: `Re: ${subject ?? "your site"}`, html }]);
  return Response.json({ ok: true, summary, lines });
}

/** Where the dashboard lives: the root domain, plain http only on localhost. */
function dashboardOrigin(): string {
  const root = getRootDomain();
  return `${root.startsWith("localhost") ? "http" : "https"}://${root}`;
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}
