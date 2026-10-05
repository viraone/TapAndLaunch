import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PaidCustomer } from "./events";

/**
 * Marks a card order paid, and saves who paid when Stripe collected their name and email. Keyed on the order id, the Stripe session id and `pending`, so it can run
 * from both the webhook and the shopper's return visit — whichever comes first wins, and the second
 * is a harmless no-op.
 */
export async function markOrderPaid(
  admin: SupabaseClient<Database>,
  input: { orderId: string; sessionId: string; paymentIntentId: string | null; customer: PaidCustomer }
): Promise<{ error: string | null }> {
  const { error } = await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: input.paymentIntentId,
      // Orders started without the form have no contact yet; Stripe's checkout page is where it comes from.
      ...(input.customer.name ? { customer_name: input.customer.name } : {}),
      ...(input.customer.email ? { customer_email: input.customer.email } : {}),
    })
    .eq("id", input.orderId)
    .eq("stripe_checkout_session_id", input.sessionId)
    .eq("status", "pending");
  return { error: error?.message ?? null };
}
