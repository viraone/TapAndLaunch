import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PaidDetails } from "./events";

/**
 * Marks a card order paid, with who paid and what Stripe charged on top of the items (shipping, tax,
 * a promo code's discount, the address). Keyed on the order id, the Stripe session id and `pending`,
 * so it can run from both the webhook and the shopper's return visit — whichever comes first wins,
 * and the second is a harmless no-op.
 */
export async function markOrderPaid(
  admin: SupabaseClient<Database>,
  input: { orderId: string; sessionId: string } & PaidDetails
): Promise<{ error: string | null }> {
  const { error } = await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: input.paymentIntentId,
      stripe_subscription_id: input.subscriptionId,
      // Orders started without the form have no contact yet; Stripe's checkout page is where it comes from.
      ...(input.customer.name ? { customer_name: input.customer.name } : {}),
      ...(input.customer.email ? { customer_email: input.customer.email } : {}),
      // The items' subtotal was saved when the order opened; Stripe's total is what was actually charged.
      ...(input.totalCents !== null ? { total_cents: input.totalCents } : {}),
      shipping_cents: input.shippingCents,
      tax_cents: input.taxCents,
      discount_cents: input.discountCents,
      shipping_name: input.shipping?.name ?? null,
      shipping_address: input.shipping?.address ?? null,
    })
    .eq("id", input.orderId)
    .eq("stripe_checkout_session_id", input.sessionId)
    .eq("status", "pending");
  return { error: error?.message ?? null };
}
