import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Marks a card order paid. Keyed on the order id, the Stripe session id and `pending`, so it can run
 * from both the webhook and the shopper's return visit — whichever comes first wins, and the second
 * is a harmless no-op.
 */
export async function markOrderPaid(
  admin: SupabaseClient<Database>,
  input: { orderId: string; sessionId: string; paymentIntentId: string | null }
): Promise<{ error: string | null }> {
  const { error } = await admin
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent_id: input.paymentIntentId })
    .eq("id", input.orderId)
    .eq("stripe_checkout_session_id", input.sessionId)
    .eq("status", "pending");
  return { error: error?.message ?? null };
}
