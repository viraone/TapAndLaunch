import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { verifyDomain } from "@/lib/domains/vercel";
import { companionOptions } from "@/lib/domains/companion";
import { pointDomainAtUs } from "@/lib/domains/namesilo";

/**
 * Re-checks a pending custom domain's DNS/verification status with Vercel. A domain in the platform's NameSilo
 * account whose DNS could not be written when it was attached (a freshly registered domain is not always ready
 * right away) gets another go here, so "Check again" fixes it instead of showing records to add by hand for ever.
 */
export async function POST(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  if (!(await isAppEditor(supabase, appId))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  const { data: app } = await supabase.from("apps").select("custom_domain, custom_domain_dns").eq("id", appId).maybeSingle();
  if (!app?.custom_domain) {
    return Response.json({ error: "This app has no custom domain to verify" }, { status: 400 });
  }

  const twin = await companionOptions(appId, app.custom_domain);
  let result = await verifyDomain(app.custom_domain, twin);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  let dnsSet = app.custom_domain_dns === "namesilo";
  if (!result.verified && !dnsSet && result.verification.length > 0) {
    const dns = await pointDomainAtUs(app.custom_domain, result.verification);
    if (dns.status === "set") {
      dnsSet = true;
      const again = await verifyDomain(app.custom_domain, twin);
      if (!again.error) result = again;
    }
  }

  const { data: updated, error } = await supabase
    .from("apps")
    .update({
      custom_domain_status: result.verified ? "verified" : "pending",
      custom_domain_verification: result.verification,
      ...(dnsSet ? { custom_domain_dns: "namesilo" as const } : {}),
    })
    .eq("id", appId)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ app: updated });
}
