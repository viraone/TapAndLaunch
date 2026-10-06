import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platform/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

/**
 * Platform admins only: what Stripe says about the TapAndLaunch account itself, in Stripe's own words, for the daily
 * board and for finding out why Connect refuses to create store accounts. Holds no keys or personal details.
 */
export async function GET() {
  if (!isStripeConfigured()) return Response.json({ error: "Stripe isn't configured." }, { status: 503 });
  const supabase = await createClient();
  if (!(await isPlatformAdmin(supabase))) return Response.json({ error: "Not allowed" }, { status: 403 });
  try {
    // The authenticated account itself (/v1/account); this SDK version types `accounts.retrieve` as needing an id.
    const a = (await getStripe().rawRequest("GET", "/v1/account")) as Stripe.Account;
    return Response.json({
      id: a.id,
      charges_enabled: a.charges_enabled,
      payouts_enabled: a.payouts_enabled,
      details_submitted: a.details_submitted,
      requirements: {
        currently_due: a.requirements?.currently_due ?? [],
        eventually_due: a.requirements?.eventually_due ?? [],
        past_due: a.requirements?.past_due ?? [],
        pending_verification: a.requirements?.pending_verification ?? [],
        disabled_reason: a.requirements?.disabled_reason ?? null,
      },
      capabilities: a.capabilities ?? {},
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
