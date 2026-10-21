import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getStripeAccountRow } from "./accounts";
import { getStripe, isStripeConfigured } from "./server";

/**
 * Whether the merchant's Stripe account can work out sales tax at checkout.
 * - `not_connected`: no finished Stripe account, so there's no checkout to tax yet.
 * - `needs_setup`: Stripe Tax hasn't been given what it needs (an origin address, a default tax
 *   category); the merchant turns it on in their own Stripe dashboard.
 * - `active`: Stripe Tax is ready; `automatic_tax` on a checkout will work.
 * - `unknown`: Stripe couldn't be asked just now.
 */
export type TaxReadiness = "not_connected" | "needs_setup" | "active" | "unknown";

export async function taxReadiness(admin: SupabaseClient<Database>, organizationId: string): Promise<TaxReadiness> {
  if (!isStripeConfigured()) return "not_connected";
  const account = await getStripeAccountRow(admin, organizationId);
  if (!account?.charges_enabled) return "not_connected";
  try {
    const settings = await getStripe().tax.settings.retrieve({}, { stripeAccount: account.stripe_account_id });
    return settings.status === "active" ? "active" : "needs_setup";
  } catch (error) {
    console.error("stripe tax settings failed:", error instanceof Error ? error.message : error);
    return "unknown";
  }
}
