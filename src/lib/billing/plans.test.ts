import { describe, expect, it } from "vitest";
import { billingFromSubscription, billingState, bannerFor, formatPlanPrice, isInGoodStanding, planChip } from "./plans";

const now = new Date("2026-10-05T12:00:00Z");
const row = (over: Partial<Parameters<typeof billingState>[0] & object> = {}) => ({
  status: "trialing" as const,
  trial_ends_at: "2026-10-20T12:00:00Z",
  plan_interval: null,
  current_period_end: null,
  cancel_at_period_end: false,
  ...over,
});

describe("billingState", () => {
  it("counts days left in a trial, rounding up", () => {
    expect(billingState(row(), now)).toEqual({ kind: "trial", daysLeft: 15, endsAt: "2026-10-20T12:00:00Z" });
    expect(billingState(row({ trial_ends_at: "2026-10-05T12:30:00Z" }), now)).toMatchObject({ kind: "trial", daysLeft: 1 });
  });
  it("expires a trial that has run out", () => {
    expect(billingState(row({ trial_ends_at: "2026-10-05T12:00:00Z" }), now).kind).toBe("trial_expired");
  });
  it("never locks out a missing row or a trial with no end", () => {
    expect(billingState(null, now).kind).toBe("complimentary");
    expect(billingState(row({ trial_ends_at: null }), now).kind).toBe("complimentary");
  });
  it("reports paid, failed and canceled plans", () => {
    expect(billingState(row({ status: "active", plan_interval: "year", current_period_end: "2027-10-05T00:00:00Z" }), now)).toEqual({ kind: "active", interval: "year", renewsAt: "2027-10-05T00:00:00Z", cancelsAtPeriodEnd: false });
    expect(billingState(row({ status: "past_due" }), now).kind).toBe("past_due");
    expect(billingState(row({ status: "canceled", current_period_end: "2026-10-01T00:00:00Z" }), now)).toEqual({ kind: "canceled", endedAt: "2026-10-01T00:00:00Z" });
  });
});

describe("isInGoodStanding", () => {
  it("keeps free, trial and paid apps running", () => {
    expect(isInGoodStanding({ kind: "complimentary" }, now)).toBe(true);
    expect(isInGoodStanding({ kind: "trial", daysLeft: 3, endsAt: "x" }, now)).toBe(true);
    expect(isInGoodStanding({ kind: "active", interval: "month", renewsAt: null, cancelsAtPeriodEnd: false }, now)).toBe(true);
  });
  it("pauses an expired trial", () => {
    expect(isInGoodStanding({ kind: "trial_expired", endedAt: "x" }, now)).toBe(false);
  });
  it("gives a failed payment a week of grace", () => {
    expect(isInGoodStanding({ kind: "past_due" }, now, new Date("2026-10-01T12:00:00Z"))).toBe(true);
    expect(isInGoodStanding({ kind: "past_due" }, now, new Date("2026-09-20T12:00:00Z"))).toBe(false);
    expect(isInGoodStanding({ kind: "past_due" }, now)).toBe(true);
  });
  it("lets a canceled plan run to the end of what was paid for", () => {
    expect(isInGoodStanding({ kind: "canceled", endedAt: "2026-10-20T00:00:00Z" }, now)).toBe(true);
    expect(isInGoodStanding({ kind: "canceled", endedAt: "2026-10-01T00:00:00Z" }, now)).toBe(false);
    expect(isInGoodStanding({ kind: "canceled", endedAt: null }, now)).toBe(false);
  });
});

describe("bannerFor", () => {
  it("only nags when something needs doing", () => {
    expect(bannerFor({ kind: "trial", daysLeft: 20, endsAt: "x" })).toBeNull();
    expect(bannerFor({ kind: "trial", daysLeft: 1, endsAt: "x" })?.text).toBe("Your free trial ends in 1 day.");
    expect(bannerFor({ kind: "trial_expired", endedAt: "x" })?.tone).toBe("warn");
    expect(bannerFor({ kind: "complimentary" })).toBeNull();
    expect(bannerFor({ kind: "active", interval: null, renewsAt: null, cancelsAtPeriodEnd: false })).toBeNull();
  });
});

describe("billingFromSubscription", () => {
  const sub = (status: string, over = {}) => ({
    id: "sub_1",
    status,
    cancel_at_period_end: false,
    customer: "cus_1",
    items: { data: [{ current_period_end: 1790000000, price: { recurring: { interval: "year" } } }] },
    ...over,
  });
  it("maps Stripe statuses to ours", () => {
    expect(billingFromSubscription(sub("active")).status).toBe("active");
    expect(billingFromSubscription(sub("trialing")).status).toBe("active");
    expect(billingFromSubscription(sub("past_due")).status).toBe("past_due");
    expect(billingFromSubscription(sub("canceled")).status).toBe("canceled");
  });
  it("keeps the ids, interval and renewal date", () => {
    expect(billingFromSubscription(sub("active"))).toEqual({
      status: "active",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      plan_interval: "year",
      current_period_end: new Date(1790000000 * 1000).toISOString(),
      cancel_at_period_end: false,
    });
    expect(billingFromSubscription(sub("active", { customer: { id: "cus_9" } })).stripe_customer_id).toBe("cus_9");
  });
  it("knows it's ending whichever way Stripe says so (the customer portal sets a cancel date, not the flag)", () => {
    expect(billingFromSubscription(sub("trialing", { cancel_at: 1790000000 })).cancel_at_period_end).toBe(true);
    expect(billingFromSubscription(sub("active", { cancel_at_period_end: true })).cancel_at_period_end).toBe(true);
    expect(billingFromSubscription(sub("active", { cancel_at: null })).cancel_at_period_end).toBe(false);
  });
});

describe("planChip", () => {
  it("says where the plan stands in a few words", () => {
    expect(planChip({ kind: "complimentary" })).toBe("Free access");
    expect(planChip({ kind: "trial", daysLeft: 1, endsAt: "x" })).toBe("Free trial · 1 day left");
    expect(planChip({ kind: "trial", daysLeft: 12, endsAt: "x" })).toBe("Free trial · 12 days left");
    expect(planChip({ kind: "active", interval: "year", renewsAt: null, cancelsAtPeriodEnd: false })).toBe("Standard plan");
    expect(planChip({ kind: "trial_expired", endedAt: "x" })).toBe("Trial ended");
  });
});

describe("formatPlanPrice", () => {
  it("shows the monthly and yearly prices, and what the yearly plan saves", () => {
    expect(formatPlanPrice("month")).toBe("$10/month");
    expect(formatPlanPrice("year")).toBe("$100/year (save $20)");
  });
});
