import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { actionFor } from "./events";

const event = (type: string, object: Record<string, unknown>) => ({ type, data: { object } }) as unknown as Stripe.Event;

describe("actionFor", () => {
  it("marks an order paid when a card checkout completes", () => {
    const a = actionFor(event("checkout.session.completed", { id: "cs_1", payment_status: "paid", metadata: { order_id: "o1" }, payment_intent: "pi_1" }));
    expect(a).toEqual({ kind: "order_paid", orderId: "o1", sessionId: "cs_1", paymentIntentId: "pi_1" });
  });

  it("falls back to client_reference_id and accepts an expanded payment intent", () => {
    const a = actionFor(event("checkout.session.completed", { id: "cs_1", payment_status: "paid", client_reference_id: "o2", metadata: {}, payment_intent: { id: "pi_9" } }));
    expect(a).toMatchObject({ kind: "order_paid", orderId: "o2", paymentIntentId: "pi_9" });
  });

  it("waits for the money on delayed payment methods", () => {
    expect(actionFor(event("checkout.session.completed", { id: "cs_1", payment_status: "unpaid", metadata: { order_id: "o1" } }))).toEqual({ kind: "ignore" });
    expect(actionFor(event("checkout.session.async_payment_succeeded", { id: "cs_1", payment_status: "paid", metadata: { order_id: "o1" }, payment_intent: "pi_1" })).kind).toBe("order_paid");
  });

  it("ignores a checkout that isn't tied to one of our orders", () => {
    expect(actionFor(event("checkout.session.completed", { id: "cs_1", payment_status: "paid", metadata: {} }))).toEqual({ kind: "ignore" });
  });

  it("cancels the order when the checkout expires or the payment fails", () => {
    expect(actionFor(event("checkout.session.expired", { id: "cs_1", metadata: { order_id: "o1" } }))).toEqual({ kind: "order_cancelled", orderId: "o1", sessionId: "cs_1" });
    expect(actionFor(event("checkout.session.async_payment_failed", { id: "cs_1", metadata: { order_id: "o1" } })).kind).toBe("order_cancelled");
  });

  it("marks refunded only for a full refund", () => {
    expect(actionFor(event("charge.refunded", { refunded: true, payment_intent: "pi_1" }))).toEqual({ kind: "order_refunded", paymentIntentId: "pi_1" });
    expect(actionFor(event("charge.refunded", { refunded: false, payment_intent: "pi_1" }))).toEqual({ kind: "ignore" });
    expect(actionFor(event("charge.refunded", { refunded: true, payment_intent: null }))).toEqual({ kind: "ignore" });
  });

  it("tracks the merchant's Stripe account setup", () => {
    expect(actionFor(event("account.updated", { id: "acct_1", charges_enabled: true, details_submitted: true }))).toEqual({
      kind: "account_updated", accountId: "acct_1", chargesEnabled: true, detailsSubmitted: true,
    });
  });

  it("ignores events it doesn't use", () => {
    expect(actionFor(event("customer.created", { id: "cus_1" }))).toEqual({ kind: "ignore" });
  });
});
