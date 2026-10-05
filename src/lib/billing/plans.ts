import type { Database } from "@/types/database";

export type BillingRow = Database["public"]["Tables"]["org_billing"]["Row"];

/** The one plan: $10 a month, or $100 a year (two months cheaper than paying monthly). */
export const PLAN = {
  name: "Standard",
  currency: "usd",
  monthlyCents: 1000,
  yearlyCents: 10000,
} as const;

/** Must match the 30 in migration 0025 (the trigger that starts a new organization's trial). */
export const TRIAL_DAYS = 30;

/** Stripe price lookup keys, so the same code works in sandbox and live with no price ids to copy around. */
export const PRICE_LOOKUP_KEYS = { month: "tapandlaunch_standard_monthly", year: "tapandlaunch_standard_yearly" } as const;

/** Days after a failed payment before apps are paused (when billing is enforced). */
export const PAST_DUE_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type BillingState =
  | { kind: "complimentary" }
  | { kind: "trial"; daysLeft: number; endsAt: string }
  | { kind: "trial_expired"; endedAt: string }
  | { kind: "active"; interval: "month" | "year" | null; renewsAt: string | null; cancelsAtPeriodEnd: boolean }
  | { kind: "past_due" }
  | { kind: "canceled"; endedAt: string | null };

/** What an organization's billing row means right now. A missing row counts as a trial that has not been recorded: never a lock-out. */
export function billingState(row: Pick<BillingRow, "status" | "trial_ends_at" | "plan_interval" | "current_period_end" | "cancel_at_period_end"> | null, now: Date): BillingState {
  if (!row) return { kind: "complimentary" };
  switch (row.status) {
    case "complimentary":
      return { kind: "complimentary" };
    case "active":
      return { kind: "active", interval: row.plan_interval, renewsAt: row.current_period_end, cancelsAtPeriodEnd: row.cancel_at_period_end };
    case "past_due":
      return { kind: "past_due" };
    case "canceled":
      return { kind: "canceled", endedAt: row.current_period_end };
    case "trialing": {
      if (!row.trial_ends_at) return { kind: "complimentary" };
      const left = new Date(row.trial_ends_at).getTime() - now.getTime();
      if (left <= 0) return { kind: "trial_expired", endedAt: row.trial_ends_at };
      return { kind: "trial", daysLeft: Math.ceil(left / DAY_MS), endsAt: row.trial_ends_at };
    }
  }
}

/**
 * Whether an organization's published apps should keep running. Complimentary, trial and paid always do; a failed
 * payment gets a grace period; an expired trial or a canceled plan does not.
 */
export function isInGoodStanding(state: BillingState, now: Date, lastPaymentFailedAt?: Date | null): boolean {
  switch (state.kind) {
    case "complimentary":
    case "trial":
    case "active":
      return true;
    case "past_due":
      return !lastPaymentFailedAt || now.getTime() - lastPaymentFailedAt.getTime() < PAST_DUE_GRACE_DAYS * DAY_MS;
    case "trial_expired":
      return false;
    case "canceled":
      // A canceled plan runs to the end of the period that was already paid for.
      return !!state.endedAt && new Date(state.endedAt).getTime() > now.getTime();
  }
}

/** Billing only pauses apps when `BILLING_ENFORCED=true`, so turning plans on is a deliberate step. */
export function isBillingEnforced(): boolean {
  return process.env.BILLING_ENFORCED === "true";
}

/** What `/dashboard` should nag about: a trial that is nearly over, one that is over, or a payment that failed. */
export function bannerFor(state: BillingState): { tone: "info" | "warn"; text: string; action: string } | null {
  switch (state.kind) {
    case "trial":
      return state.daysLeft <= 7
        ? { tone: "info", text: `Your free trial ends in ${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"}.`, action: "Choose a plan" }
        : null;
    case "trial_expired":
      return { tone: "warn", text: "Your free trial has ended. Choose a plan to keep your apps live.", action: "Choose a plan" };
    case "past_due":
      return { tone: "warn", text: "Your last payment didn't go through. Update your card to keep your apps live.", action: "Update card" };
    case "canceled":
      return { tone: "warn", text: "Your plan was canceled. Choose a plan to keep your apps live.", action: "Choose a plan" };
    default:
      return null;
  }
}

/** The plan fields our table keeps, from a Stripe subscription. Pure so it can be tested without Stripe. */
export interface SubscriptionLike {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  customer: string | { id: string };
  items: { data: Array<{ current_period_end: number; price: { recurring?: { interval: string } | null } }> };
}

export function billingFromSubscription(sub: SubscriptionLike): Pick<BillingRow, "status" | "stripe_customer_id" | "stripe_subscription_id" | "plan_interval" | "current_period_end" | "cancel_at_period_end"> {
  const item = sub.items.data[0];
  const interval = item?.price.recurring?.interval;
  const status: BillingRow["status"] =
    sub.status === "active" || sub.status === "trialing"
      ? "active"
      : sub.status === "past_due" || sub.status === "unpaid" || sub.status === "incomplete"
        ? "past_due"
        : "canceled";
  return {
    status,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    plan_interval: interval === "month" || interval === "year" ? interval : null,
    current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
  };
}

/** A few words for the plan chip at the top of Settings. */
export function planChip(state: BillingState): string {
  switch (state.kind) {
    case "complimentary":
      return "Free access";
    case "trial":
      return `Free trial · ${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"} left`;
    case "trial_expired":
      return "Trial ended";
    case "active":
      return `${PLAN.name} plan`;
    case "past_due":
      return "Payment failed";
    case "canceled":
      return "Plan canceled";
  }
}

export function formatPlanPrice(interval: "month" | "year"): string {
  const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: PLAN.currency.toUpperCase(), maximumFractionDigits: 0 }).format(cents / 100);
  const saved = money(PLAN.monthlyCents * 12 - PLAN.yearlyCents);
  return interval === "year" ? `${money(PLAN.yearlyCents)}/year (save ${saved})` : `${money(PLAN.monthlyCents)}/month`;
}
