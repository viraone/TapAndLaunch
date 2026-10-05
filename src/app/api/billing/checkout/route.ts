import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOrganizationId, getMemberships } from "@/lib/org";
import { isStripeConfigured } from "@/lib/stripe/server";
import { getRootDomain } from "@/lib/tenant";
import { createSubscriptionCheckout, dashboardOrigin } from "@/lib/billing/stripe";

const Schema = z.object({ interval: z.enum(["month", "year"]) });

/** Starts a subscription checkout for the signed-in admin's active organization. Returns Stripe's page to send them to. */
export async function POST(request: Request) {
  if (!isStripeConfigured()) return Response.json({ error: "Billing is not set up yet" }, { status: 503 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose monthly or yearly" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const memberships = await getMemberships(supabase);
  const organizationId = await getActiveOrganizationId(supabase, memberships);
  const membership = memberships.find((m) => m.organization_id === organizationId);
  if (!organizationId || membership?.role !== "admin") {
    return Response.json({ error: "Only an organization admin can choose a plan" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: billing } = await admin.from("org_billing").select("status, trial_ends_at").eq("organization_id", organizationId).maybeSingle();
  if (billing?.status === "active") return Response.json({ error: "This organization already has a plan" }, { status: 409 });

  try {
    const url = await createSubscriptionCheckout({
      admin,
      organizationId,
      orgName: membership.name,
      email: user.email,
      interval: parsed.data.interval,
      origin: dashboardOrigin(getRootDomain()),
      trialEndsAt: billing?.status === "trialing" ? (billing.trial_ends_at ?? null) : null,
    });
    return Response.json({ url });
  } catch (error) {
    console.error("billing checkout failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Couldn't open checkout. Please try again." }, { status: 502 });
  }
}
