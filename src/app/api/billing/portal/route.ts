import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { isStripeConfigured } from "@/lib/stripe/server";
import { getRootDomain } from "@/lib/tenant";
import { createPortalUrl, dashboardOrigin } from "@/lib/billing/stripe";

/** Sends an admin to Stripe's page for changing their card, switching plan, or canceling. */
export async function POST() {
  if (!isStripeConfigured()) return Response.json({ error: "Billing is not set up yet" }, { status: 503 });

  const supabase = await createClient();
  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  const membership = memberships.find((m) => m.organization_id === organizationId);
  if (!organizationId || membership?.role !== "admin") {
    return Response.json({ error: "Only an organization admin can manage billing" }, { status: 403 });
  }

  const { data: billing } = await createAdminClient().from("org_billing").select("stripe_customer_id").eq("organization_id", organizationId).maybeSingle();
  if (!billing?.stripe_customer_id) return Response.json({ error: "No plan to manage yet" }, { status: 400 });

  try {
    return Response.json({ url: await createPortalUrl(billing.stripe_customer_id, dashboardOrigin(getRootDomain())) });
  } catch (error) {
    console.error("billing portal failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't open billing. Please try again." }, { status: 502 });
  }
}
