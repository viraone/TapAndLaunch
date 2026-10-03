import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { accountReadiness } from "./readiness";

const account = (parts: Record<string, unknown>) => parts as unknown as Stripe.V2.Core.Account;

describe("accountReadiness", () => {
  it("is ready when card payments are active and nothing is due", () => {
    const r = accountReadiness(account({ configuration: { merchant: { capabilities: { card_payments: { status: "active" } } } }, requirements: { summary: {} } }));
    expect(r).toEqual({ chargesEnabled: true, detailsSubmitted: true });
  });

  it("is not ready while Stripe still needs details (a just-created account)", () => {
    const r = accountReadiness(
      account({ configuration: { merchant: { capabilities: { card_payments: { status: "restricted" } } } }, requirements: { summary: { minimum_deadline: { status: "past_due" } } } })
    );
    expect(r).toEqual({ chargesEnabled: false, detailsSubmitted: false });
  });

  it("has submitted everything but waits for Stripe's review while the capability is pending", () => {
    const r = accountReadiness(account({ configuration: { merchant: { capabilities: { card_payments: { status: "pending" } } } }, requirements: { summary: {} } }));
    expect(r).toEqual({ chargesEnabled: false, detailsSubmitted: true });
  });

  it("treats a missing merchant configuration as not ready", () => {
    expect(accountReadiness(account({})).chargesEnabled).toBe(false);
  });
});
