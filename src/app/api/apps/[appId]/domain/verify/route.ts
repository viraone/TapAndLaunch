import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { verifyDomain } from "@/lib/domains/vercel";

/** Re-checks a pending custom domain's DNS/verification status with Vercel. */
export async function POST(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  if (!(await isAppEditor(supabase, appId))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: app } = await supabase.from("apps").select("custom_domain").eq("id", appId).maybeSingle();
  if (!app?.custom_domain) {
    return Response.json({ error: "This app has no custom domain to verify" }, { status: 400 });
  }

  const result = await verifyDomain(app.custom_domain);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("apps")
    .update({
      custom_domain_status: result.verified ? "verified" : "pending",
      custom_domain_verification: result.verification,
    })
    .eq("id", appId)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ app: updated });
}
