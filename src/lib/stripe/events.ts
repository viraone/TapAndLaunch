import type Stripe from "stripe";
import type { ShippingAddress } from "@/types/database";

/** What a Stripe webhook event means for our data. Kept free of any database code so it can be tested on its own. */
export type StripeAction =
  | ({ kind: "order_paid"; orderId: string; sessionId: string } & PaidDetails)
  | { kind: "order_cancelled"; orderId: string; sessionId: string }
  | { kind: "order_refunded"; paymentIntentId: string }
  | { kind: "account_updated"; accountId: string; chargesEnabled: boolean; detailsSubmitted: boolean }
  | { kind: "ignore" };

/** Who paid, as typed into Stripe's checkout page. */
export interface PaidCustomer {
  name: string | null;
  email: string | null;
}

/** Everything a completed checkout tells us about the order: who paid, what Stripe charged on top, where it ships. */
export interface PaidDetails {
  paymentIntentId: string | null;
  subscriptionId: string | null;
  customer: PaidCustomer;
  /** Stripe's grand total; null when the session didn't say (an old event shape). */
  totalCents: number | null;
  shippingCents: number;
  taxCents: number;
  discountCents: number;
  shipping: { name: string | null; address: ShippingAddress } | null;
}

/** The subset of a Checkout Session these readers need; a webhook event and a retrieve both carry it. */
export type PaidSession = Pick<Stripe.Checkout.Session, "payment_intent" | "subscription" | "customer_details" | "amount_total" | "total_details" | "collected_information">;

export function customerOf(s: Pick<PaidSession, "customer_details">): PaidCustomer {
  return { name: s.customer_details?.name ?? null, email: s.customer_details?.email ?? null };
}

const idOf = (v: string | { id: string } | null | undefined): string | null => (typeof v === "string" ? v : (v?.id ?? null));

export function paidDetailsOf(s: PaidSession): PaidDetails {
  const ship = s.collected_information?.shipping_details ?? null;
  return {
    paymentIntentId: idOf(s.payment_intent),
    subscriptionId: idOf(s.subscription),
    customer: customerOf(s),
    totalCents: typeof s.amount_total === "number" ? s.amount_total : null,
    shippingCents: s.total_details?.amount_shipping ?? 0,
    taxCents: s.total_details?.amount_tax ?? 0,
    discountCents: s.total_details?.amount_discount ?? 0,
    shipping: ship
      ? {
          name: ship.name ?? null,
          address: {
            line1: ship.address?.line1 ?? null,
            line2: ship.address?.line2 ?? null,
            city: ship.address?.city ?? null,
            state: ship.address?.state ?? null,
            postal_code: ship.address?.postal_code ?? null,
            country: ship.address?.country ?? null,
          },
        }
      : null,
  };
}

export function actionFor(event: Stripe.Event): StripeAction {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      const orderId = s.metadata?.order_id ?? s.client_reference_id;
      // A card payment is `paid` right away. Bank-style payments complete the session while still
      // `unpaid`, and a later async_payment_succeeded event says the money arrived.
      if (!orderId || s.payment_status !== "paid") return { kind: "ignore" };
      return { kind: "order_paid", orderId, sessionId: s.id, ...paidDetailsOf(s) };
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
