import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { accountReadiness } from "./readiness";
import { getStripe } from "./server";

type Admin = SupabaseClient<Database>;

export async function getStripeAccountRow(admin: Admin, organizationId: string) {
  const { data } = await admin.from("stripe_accounts").select("*").eq("organization_id", organizationId).maybeSingle();
  return data;
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
