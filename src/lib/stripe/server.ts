import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/** Payments are optional: with no `STRIPE_SECRET_KEY` the app keeps the
 * "request to buy" flow and the dashboard hides the Connect card. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** True for a test-mode / sandbox key, so the dashboard can say so. */
export function isStripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}
