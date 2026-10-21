import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { attachDomain } from "@/lib/domains/attach";
import { removeDomain } from "@/lib/domains/vercel";
import { companionOptions } from "@/lib/domains/companion";

const AddDomainSchema = z.object({
  domain: z.string().min(1),
});

/**
 * Attaches a custom domain to an app (`attachDomain`: Vercel, DNS when the domain is ours, then the app row). Unlike
 * most writes in this repo, the authorization check has to happen explicitly (`isAppEditor`) *before* doing anything —
 * the Vercel API call is an external side effect RLS can't gate, so relying on the DB update to fail afterward would
 * still let a non-editor trigger it.
 */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  if (!(await isAppEditor(supabase, appId))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = AddDomainSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const result = await attachDomain(supabase, appId, parsed.data.domain);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json(result);
}

/** Detaches an app's custom domain, both from Vercel and from the app row. */
export async function DELETE(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  if (!(await isAppEditor(supabase, appId))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: app } = await supabase.from("apps").select("custom_domain").eq("id", appId).maybeSingle();
  if (!app) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (app.custom_domain) {
    const result = await removeDomain(app.custom_domain, await companionOptions(appId, app.custom_domain));
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("apps")
    .update({ custom_domain: null, custom_domain_status: null, custom_domain_verification: [], custom_domain_dns: null })
    .eq("id", appId);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
