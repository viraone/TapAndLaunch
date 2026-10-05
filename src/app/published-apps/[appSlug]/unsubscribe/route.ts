import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml, verifyUnsubscribe } from "@/lib/notifications/email-content";

/**
 * The link at the bottom of every app email. GET only shows a button — mail scanners open links on
 * their own, and that must not unsubscribe anyone. POST does it, both from that button and from the
 * one-click header (`List-Unsubscribe-Post`) that Gmail and Apple Mail send. The signed token in the link
 * is the only proof needed, so it works with no login.
 */
function page(appName: string, message: string, form?: { m: string; t: string }): Response {
  const button = form
    ? `<form method="post" action="/unsubscribe?m=${encodeURIComponent(form.m)}&t=${encodeURIComponent(form.t)}"><button type="submit" style="margin-top:16px;min-height:44px;padding:0 24px;border:0;border-radius:10px;background:#1d1d1f;color:#fff;font-size:16px">Unsubscribe</button></form>`
    : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head><body style="margin:0;padding:48px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;text-align:center;color:#1d1d1f"><h1 style="font-size:22px">${escapeHtml(appName)}</h1><p style="font-size:16px;line-height:1.5">${escapeHtml(message)}</p>${button}</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function resolve(request: Request, appSlug: string) {
  const published = await getPublishedApp(appSlug);
  if (!published) return null;
  const url = new URL(request.url);
  const m = url.searchParams.get("m") ?? "";
  const t = url.searchParams.get("t") ?? "";
  const secret = process.env.MEMBER_SESSION_SECRET;
  const valid = !!secret && /^[0-9a-f-]{36}$/i.test(m) && !!t && verifyUnsubscribe(m, t, secret);
  return { published, m, t, valid };
}

export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const r = await resolve(request, (await context.params).appSlug);
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  const name = r.published.app.name;
  if (!r.valid) return page(name, "This unsubscribe link isn't valid.");
  return page(name, `Stop getting emails from ${name}?`, { m: r.m, t: r.t });
}

export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const r = await resolve(request, (await context.params).appSlug);
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  const name = r.published.app.name;
  if (!r.valid) return page(name, "This unsubscribe link isn't valid.");

  const { error } = await createAdminClient()
    .from("app_members")
    .update({ email_unsubscribed_at: new Date().toISOString() })
    .eq("id", r.m)
    .eq("app_id", r.published.app.id)
    .is("email_unsubscribed_at", null);
  if (error) return page(name, "Something went wrong. Please try again.");
  return page(name, `You're unsubscribed. ${name} won't send you more emails.`);
}
