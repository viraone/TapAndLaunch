import { createClient } from "@/lib/supabase/server";
import { getRootDomain } from "@/lib/tenant";
import { PREVIEW_QUERY, signPreviewToken } from "@/lib/pwa/preview";

/**
 * A preview address for the builder's "Try it" mode: the app at its real address with a signed key that lets this
 * person's browser open it even while it is a draft (see lib/pwa/preview.ts). Only a member of the app's
 * organization can ask for one; RLS makes the app lookup come back empty for anyone else.
 */
export async function POST(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: app } = await supabase.from("apps").select("id, slug, kind").eq("id", appId).maybeSingle();
  if (!app) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (app.kind === "code") {
    return Response.json({ error: "AI-written apps have their own preview" }, { status: 400 });
  }

  // Protocol-relative, like every other link to a published app, so it also works on localhost.
  const url = `//${app.slug}.${getRootDomain()}/?${PREVIEW_QUERY}=${encodeURIComponent(signPreviewToken(app.slug))}`;
  return Response.json({ url });
}
