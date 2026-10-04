import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { accountReadiness } from "./readiness";

const account = (parts: Record<string, unknown>) => parts as unknown as Stripe.V2.Core.Account;

describe("accountReadiness", () => {
  it("is ready when card payments are active and nothing is due", () => {
    const r = accountReadiness(account({ configuration: { merchant: { capabilities: { card_payments: { status: "active" } } } }, requirements: { summary: {} } }));
    expect(r).toEqual({ chargesEnabled: true, detailsSubmitted: true });
  });

  it("is not ready while the merchant still owes details (a just-created account)", () => {
    const r = accountReadiness(
      account({
        configuration: { merchant: { capabilities: { card_payments: { status: "restricted" } } } },
        requirements: { entries: [{ awaiting_action_from: "user" }, { awaiting_action_from: "stripe" }], summary: { minimum_deadline: { status: "past_due" } } },
      })
    );
    expect(r).toEqual({ chargesEnabled: false, detailsSubmitted: false });
  });

  it("counts the merchant's part as done while only Stripe's checks are outstanding", () => {
    const r = accountReadiness(
      account({
        configuration: { merchant: { capabilities: { card_payments: { status: "restricted" } } } },
        requirements: { entries: [{ awaiting_action_from: "stripe" }], summary: { minimum_deadline: { status: "past_due" } } },
      })
    );
    expect(r).toEqual({ chargesEnabled: false, detailsSubmitted: true });
  });

  it("falls back to the deadline when no requirement list is given", () => {
    const r = accountReadiness(account({ requirements: { summary: { minimum_deadline: { status: "past_due" } } } }));
    expect(r.detailsSubmitted).toBe(false);
  });

  it("has submitted everything but waits for Stripe's review while the capability is pending", () => {
    const r = accountReadiness(account({ configuration: { merchant: { capabilities: { card_payments: { status: "pending" } } } }, requirements: { summary: {} } }));
    expect(r).toEqual({ chargesEnabled: false, detailsSubmitted: true });
  });

  it("treats a missing merchant configuration as not ready", () => {
    expect(accountReadiness(account({})).chargesEnabled).toBe(false);
  });
});
