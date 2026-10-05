import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { accountReadiness } from "./readiness";
import { getStripe, isStripeConfigured } from "./server";

type Admin = SupabaseClient<Database>;

export async function getStripeAccountRow(admin: Admin, organizationId: string) {
  const { data } = await admin.from("stripe_accounts").select("*").eq("organization_id", organizationId).maybeSingle();
  return data;
}

/** True when this organization can take card payments right now (Stripe configured, account finished). */
export async function canTakeCards(admin: Admin, organizationId: string): Promise<boolean> {
  if (!isStripeConfigured()) return false;
  const account = await getStripeAccountRow(admin, organizationId);
  return !!account?.charges_enabled;
}

/** Asks Stripe for the account's current state and saves it. Used when the merchant returns from
 * Stripe's setup pages, and whenever setup is unfinished, so the dashboard is right without
 * waiting for a webhook. */
export async function syncStripeAccount(admin: Admin, organizationId: string, stripeAccountId: string) {
  const account = await getStripe().v2.core.accounts.retrieve(stripeAccountId, {
    include: ["configuration.merchant", "requirements"],
  });
  const { chargesEnabled, detailsSubmitted } = accountReadiness(account);
  const { data } = await admin
    .from("stripe_accounts")
    .update({ charges_enabled: chargesEnabled, details_submitted: detailsSubmitted })
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  return data;
}
