import type Stripe from "stripe";

/** What a Stripe webhook event means for our data. Kept free of any database code so it can be tested on its own. */
export type StripeAction =
  | { kind: "order_paid"; orderId: string; sessionId: string; paymentIntentId: string | null; customer: PaidCustomer }
  | { kind: "order_cancelled"; orderId: string; sessionId: string }
  | { kind: "order_refunded"; paymentIntentId: string }
  | { kind: "account_updated"; accountId: string; chargesEnabled: boolean; detailsSubmitted: boolean }
  | { kind: "ignore" };

/** Who paid, as typed into Stripe's checkout page. */
export interface PaidCustomer {
  name: string | null;
  email: string | null;
}

export function customerOf(s: { customer_details?: { name?: string | null; email?: string | null } | null }): PaidCustomer {
  return { name: s.customer_details?.name ?? null, email: s.customer_details?.email ?? null };
}

const idOf = (v: string | { id: string } | null | undefined): string | null => (typeof v === "string" ? v : (v?.id ?? null));

export function actionFor(event: Stripe.Event): StripeAction {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      const orderId = s.metadata?.order_id ?? s.client_reference_id;
      // A card payment is `paid` right away. Bank-style payments complete the session while still
      // `unpaid`, and a later async_payment_succeeded event says the money arrived.
      if (!orderId || s.payment_status !== "paid") return { kind: "ignore" };
      return { kind: "order_paid", orderId, sessionId: s.id, paymentIntentId: idOf(s.payment_intent), customer: customerOf(s) };
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const s = event.data.object;
      const orderId = s.metadata?.order_id ?? s.client_reference_id;
      return orderId ? { kind: "order_cancelled", orderId, sessionId: s.id } : { kind: "ignore" };
    }
    case "charge.refunded": {
      const c = event.data.object;
      const paymentIntentId = idOf(c.payment_intent);
      // `refunded` is true only when the whole charge was refunded; a partial refund keeps the order paid.
      return c.refunded && paymentIntentId ? { kind: "order_refunded", paymentIntentId } : { kind: "ignore" };
    }
    case "account.updated": {
      const a = event.data.object;
      return { kind: "account_updated", accountId: a.id, chargesEnabled: a.charges_enabled, detailsSubmitted: a.details_submitted };
    }
    default:
      return { kind: "ignore" };
  }
}
