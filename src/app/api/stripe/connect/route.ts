import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { getStripeAccountRow } from "@/lib/stripe/accounts";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

/** Where the business is based; Stripe needs it before it can create the account. Defaults to the US. */
const BodySchema = z.object({ country: z.string().regex(/^[A-Za-z]{2}$/).optional() });

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

  const body = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Choose a valid country." }, { status: 400 });
  const country = (body.data.country ?? "us").toLowerCase();

  const admin = createAdminClient();
  const stripe = getStripe();

  try {
    let row = await getStripeAccountRow(admin, organizationId);
    if (!row) {
      // Stripe's current accounts API (v2). `dashboard: "full"` gives the merchant their own Stripe
      // Dashboard for payouts and refunds, and with Stripe collecting fees and covering negative
      // balances, TapAndLaunch carries no payment risk — the same arrangement as a "Standard" account.
      const account = await stripe.v2.core.accounts.create({
        contact_email: user.email ?? undefined,
        display_name: membership.name,
        identity: { country },
        dashboard: "full",
        defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
        configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
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
    const link = await stripe.v2.core.accountLinks.create({
      account: row.stripe_account_id,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          refresh_url: `${origin}/dashboard/settings?stripe=refresh`,
          return_url: `${origin}/dashboard/settings?stripe=return`,
        },
      },
    });
    return Response.json({ url: link.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("stripe connect failed:", message);
    // Stripe's own reason is what the admin needs to act on (a platform setting, a missing capability); it holds no secrets.
    return Response.json({ error: `Stripe couldn't start the setup. Stripe said: ${message}` }, { status: 502 });
  }
}
