import { getPublishedApp } from "@/lib/pwa/data";
import { getCodeAppsDomain, hostRoot } from "@/lib/tenant";
import { appOrigin } from "@/lib/stripe/checkout";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCodeDocument } from "@/lib/code/document";
import { orgInGoodStanding } from "@/lib/billing/standing";
import type { CodeFiles } from "@/lib/code/files";

/**
 * The page of a published AI-written app. The Content-Security-Policy `sandbox` header gives it an opaque origin even
 * when opened directly: it can run its own scripts, but it can't read TapAndLaunch cookies, storage or other apps.
 * (The app's own page also wraps this in a sandboxed iframe, so both layers apply.)
 */
export async function GET(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  // Served only from the AI-apps domain once it's set up (never from TapAndLaunch's own).
  const codeDomain = getCodeAppsDomain();
  if (codeDomain && hostRoot(request.headers.get("host")) === "main") return Response.redirect(`${appOrigin(appSlug, codeDomain)}/app-code`, 308);
  const published = await getPublishedApp(appSlug);
  if (!published || published.app.kind !== "code" || !published.app.code_published_version) return new Response("Not found", { status: 404 });
  if (!(await orgInGoodStanding(published.app.organization_id))) return new Response("This app is taking a break.", { status: 503 });

  const { data } = await createAdminClient().from("app_code_versions").select("files").eq("app_id", published.app.id).eq("version", published.app.code_published_version).maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });

  const html = buildCodeDocument(data.files as CodeFiles, { title: published.app.manifest.name ?? published.app.name, accent: published.app.theme.primary_color });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
