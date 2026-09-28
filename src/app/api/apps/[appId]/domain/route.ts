import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { validateCustomDomain } from "@/lib/domains/validate";
import { addDomain, removeDomain } from "@/lib/domains/vercel";

const AddDomainSchema = z.object({
  domain: z.string().min(1),
});

/**
 * Attaches a custom domain to an app: adds it to the Vercel project, then
 * stores the result. Unlike most writes in this repo, the authorization
 * check has to happen explicitly (`isAppEditor`) *before* doing anything —
 * the Vercel API call is an external side effect RLS can't gate, so
 * relying on the DB update to fail afterward would still let a non-editor
 * trigger it.
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

  const domain = parsed.data.domain.trim().toLowerCase();
  const validationError = validateCustomDomain(domain);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const result = await addDomain(domain);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const { data: app, error } = await supabase
    .from("apps")
    .update({
      custom_domain: domain,
      custom_domain_status: result.verified ? "verified" : "pending",
      custom_domain_verification: result.verification,
    })
    .eq("id", appId)
    .select("*")
    .single();

  if (error) {
    // The domain is now attached on Vercel's side but the DB write that
    // was supposed to record it failed (not authorized, app not found,
    // etc.) — detach it again rather than leaving an orphaned Vercel
    // domain no app in this system knows about.
    await removeDomain(domain).catch(() => {});
    const message = error.code === "23505" ? "That domain is already in use by another app" : error.message;
    return Response.json({ error: message }, { status: 400 });
  }

  return Response.json({ app });
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
    const result = await removeDomain(app.custom_domain);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("apps")
    .update({ custom_domain: null, custom_domain_status: null, custom_domain_verification: [] })
    .eq("id", appId);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
