import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getStripe } from "./server";

type Admin = SupabaseClient<Database>;

export async function getStripeAccountRow(admin: Admin, organizationId: string) {
  const { data } = await admin.from("stripe_accounts").select("*").eq("organization_id", organizationId).maybeSingle();
  return data;
}

/** Asks Stripe for the account's current state and saves it. Used when the merchant returns from
 * Stripe's setup pages, so the dashboard is right even before the webhook arrives. */
export async function syncStripeAccount(admin: Admin, organizationId: string, stripeAccountId: string) {
  const account = await getStripe().accounts.retrieve(stripeAccountId);
  const { data } = await admin
    .from("stripe_accounts")
    .update({ charges_enabled: account.charges_enabled, details_submitted: account.details_submitted })
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  return data;
}
