import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { getStripeAccountRow } from "@/lib/stripe/accounts";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

/**
 * Starts (or resumes) connecting the organization's Stripe account. Creates the Stripe account the
 * first time, then returns a one-time link to Stripe's own setup pages. Organization admins only.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return Response.json({ error: "Online payments aren't switched on yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  const membership = memberships.find((m) => m.organization_id === organizationId);
  if (!organizationId || membership?.role !== "admin") {
    return Response.json({ error: "Only an organization admin can connect payments." }, { status: 403 });
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  try {
    let row = await getStripeAccountRow(admin, organizationId);
    if (!row) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: user.email ?? undefined,
        metadata: { organization_id: organizationId },
      });
      const { data, error } = await admin
        .from("stripe_accounts")
        .insert({ organization_id: organizationId, stripe_account_id: account.id })
        .select("*")
        .single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      row = data;
    }

    const origin = new URL(request.url).origin;
    const link = await stripe.accountLinks.create({
      account: row.stripe_account_id,
      type: "account_onboarding",
      refresh_url: `${origin}/dashboard/settings?stripe=refresh`,
      return_url: `${origin}/dashboard/settings?stripe=return`,
    });
    return Response.json({ url: link.url });
  } catch (error) {
    console.error("stripe connect failed:", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Stripe couldn't start the setup. Check that Connect is turned on for your Stripe account." },
      { status: 502 }
    );
  }
}
