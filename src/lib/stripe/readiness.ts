import type Stripe from "stripe";

/** What the dashboard needs to know about a merchant's Stripe account. */
export interface AccountReadiness {
  /** Card payments are switched on, so customers can pay. */
  chargesEnabled: boolean;
  /** Nothing is still due from the merchant. */
  detailsSubmitted: boolean;
}

/**
 * Reads a v2 account fetched with `include: ["configuration.merchant", "requirements"]`.
 * Card payments are on when that capability is `active`; the merchant has finished their part
 * when Stripe lists no deadline for anything still due.
 */
export function accountReadiness(account: Stripe.V2.Core.Account): AccountReadiness {
  const card = account.configuration?.merchant?.capabilities?.card_payments;
  return {
    chargesEnabled: card?.status === "active",
    detailsSubmitted: !account.requirements?.summary?.minimum_deadline,
  };
}
