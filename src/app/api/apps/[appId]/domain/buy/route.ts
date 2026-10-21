import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppAdmin } from "@/lib/org";
import { getRootDomain } from "@/lib/tenant";
import { dashboardOrigin } from "@/lib/billing/stripe";
import { canBuyDomains, startDomainCheckout } from "@/lib/domains/purchase";

const Schema = z.object({ domain: z.string().min(3).max(70) });

/**
 * Starts buying a domain for an app: a Stripe Checkout page for one year at the registrar's price. Admins only, since
 * it costs money. The domain is registered and attached when the payment lands (`fulfillDomainOrder`).
 */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  if (!(await isAppAdmin(supabase, appId))) return Response.json({ error: "Only an organization admin can buy a domain" }, { status: 403 });
  if (!canBuyDomains()) return Response.json({ error: "Buying domains is not set up on this server" }, { status: 503 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a domain to buy" }, { status: 400 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: app } = await supabase.from("apps").select("organization_id, custom_domain").eq("id", appId).maybeSingle();
  if (!app) return Response.json({ error: "Not found" }, { status: 404 });
  if (app.custom_domain) return Response.json({ error: "This site already has a custom domain. Remove it first to buy another." }, { status: 409 });

  const { data: org } = await supabase.from("organizations").select("name").eq("id", app.organization_id).maybeSingle();
  const orgName = org?.name ?? "Customer";
  try {
    const result = await startDomainCheckout({
      admin: createAdminClient(),
      appId,
      organizationId: app.organization_id,
      orgName,
      email: user?.email,
      domain: parsed.data.domain,
      origin: dashboardOrigin(getRootDomain()),
    });
    if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ url: result.url });
  } catch (error) {
    console.error("domain checkout failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't open checkout. Please try again." }, { status: 502 });
  }
}
