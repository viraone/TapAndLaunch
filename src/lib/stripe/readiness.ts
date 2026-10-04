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
 * Card payments are on when that capability is `active`. The merchant has done their part when
 * nothing is listed as waiting on *them*; items waiting on Stripe (its checks after they submit)
 * don't count, so the dashboard can say "Stripe is checking your details" instead of asking again.
 */
export function accountReadiness(account: Stripe.V2.Core.Account): AccountReadiness {
  const card = account.configuration?.merchant?.capabilities?.card_payments;
  const entries = account.requirements?.entries;
  const detailsSubmitted = entries
    ? !entries.some((e) => e.awaiting_action_from === "user")
    : !account.requirements?.summary?.minimum_deadline;
  return { chargesEnabled: card?.status === "active", detailsSubmitted };
}
