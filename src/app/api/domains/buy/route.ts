import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { getRootDomain } from "@/lib/tenant";
import { dashboardOrigin } from "@/lib/billing/stripe";
import { canBuyDomains, startDomainCheckout } from "@/lib/domains/purchase";

const Schema = z.object({ domain: z.string().min(3).max(70) });

/**
 * Buys a domain on its own (from tapandlaunch.com/domains) for the signed-in admin's organization: a Stripe Checkout
 * page for one year at the registrar's price, back to Dashboard > Domains afterwards. Someone without an organization
 * yet is sent through onboarding first (`needsOnboarding`).
 */
export async function POST(request: Request) {
  if (!canBuyDomains()) return Response.json({ error: "Buying domains isn't available right now. Try again later." }, { status: 503 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a domain to buy" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to buy a domain", signIn: true }, { status: 401 });

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  const membership = memberships.find((m) => m.organization_id === organizationId);
  if (!organizationId || !membership) return Response.json({ error: "Create your organization first", needsOnboarding: true }, { status: 403 });
  if (membership.role !== "admin") return Response.json({ error: "Only an organization admin can buy a domain" }, { status: 403 });

  try {
    const result = await startDomainCheckout({
      admin: createAdminClient(),
      appId: null,
      organizationId,
      orgName: membership.name,
      email: user.email,
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
