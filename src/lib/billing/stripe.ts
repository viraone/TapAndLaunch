import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { PLAN, PRICE_LOOKUP_KEYS, billingFromSubscription } from "./plans";

type Admin = SupabaseClient<Database>;
type Interval = "month" | "year";

/** Stripe asks for a trial end at least 48 hours away, so a shorter remaining trial is simply not carried over. */
const MIN_TRIAL_CARRY_MS = 49 * 60 * 60 * 1000;

/**
 * The two prices for the Standard plan, found by lookup key and created on first use. That keeps sandbox and
 * live working from the same code with no price ids to copy between them.
 */
export async function ensurePrices(): Promise<Record<Interval, string>> {
  const stripe = getStripe();
  const found = await stripe.prices.list({ lookup_keys: [PRICE_LOOKUP_KEYS.month, PRICE_LOOKUP_KEYS.year], active: true, limit: 10 });
  const wanted: Record<Interval, number> = { month: PLAN.monthlyCents, year: PLAN.yearlyCents };
  const ids: Partial<Record<Interval, string>> = {};
  let productId: string | null = null;
  for (const price of found.data) {
    productId ??= typeof price.product === "string" ? price.product : price.product.id;
    const interval: Interval | null = price.lookup_key === PRICE_LOOKUP_KEYS.month ? "month" : price.lookup_key === PRICE_LOOKUP_KEYS.year ? "year" : null;
    // A price whose amount no longer matches the plan is left alone (people may still be on it) and replaced below.
    if (interval && price.unit_amount === wanted[interval] && price.currency === PLAN.currency) ids[interval] = price.id;
  }
  if (!productId) {
    productId = (await stripe.products.create({ name: `TapAndLaunch ${PLAN.name}` })).id;
  }
  for (const interval of ["month", "year"] as const) {
    if (ids[interval]) continue;
    // Stripe prices can't be edited, so a new one takes over the lookup key; existing subscribers keep their old price.
    ids[interval] = (
      await stripe.prices.create({ product: productId, currency: PLAN.currency, unit_amount: wanted[interval], recurring: { interval }, lookup_key: PRICE_LOOKUP_KEYS[interval], transfer_lookup_key: true })
    ).id;
  }
  return { month: ids.month as string, year: ids.year as string };
}

/** The organization's Stripe customer, created on first use. Shared with domain purchases, so one customer holds every charge. */
export async function customerFor(admin: Admin, organizationId: string, orgName: string, email: string | undefined): Promise<string> {
  const { data: row } = await admin.from("org_billing").select("stripe_customer_id").eq("organization_id", organizationId).maybeSingle();
  if (row?.stripe_customer_id) return row.stripe_customer_id;
  const customer = await getStripe().customers.create({ name: orgName, email, metadata: { organization_id: organizationId } });
  await admin.from("org_billing").update({ stripe_customer_id: customer.id }).eq("organization_id", organizationId);
  return customer.id;
}

/** Where the admin pays. Subscribing partway through the trial keeps the days they had left. */
export async function createSubscriptionCheckout(input: {
  admin: Admin;
  organizationId: string;
  orgName: string;
  email: string | undefined;
  interval: Interval;
  origin: string;
  trialEndsAt: string | null;
}): Promise<string> {
  const prices = await ensurePrices();
  const customer = await customerFor(input.admin, input.organizationId, input.orgName, input.email);
  const trialEnd = input.trialEndsAt ? new Date(input.trialEndsAt).getTime() : 0;
  const carryTrial = trialEnd - Date.now() > MIN_TRIAL_CARRY_MS;
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: prices[input.interval], quantity: 1 }],
    client_reference_id: input.organizationId,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { organization_id: input.organizationId },
      ...(carryTrial ? { trial_end: Math.floor(trialEnd / 1000) } : {}),
    },
    metadata: { organization_id: input.organizationId },
    success_url: `${input.origin}/dashboard/settings?billing=success`,
    cancel_url: `${input.origin}/dashboard/settings?billing=cancelled`,
  });
  if (!session.url) throw new Error("Stripe returned no checkout URL");
  return session.url;
}

/** Stripe's own page for changing the card, switching plan or canceling. */
export async function createPortalUrl(customerId: string, origin: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/dashboard/settings` });
  return session.url;
}

/**
 * Saves a subscription's state on the organization's billing row. A free (complimentary) account is never touched:
 * the `status <> 'complimentary'` is in the update itself, so it holds even when a Stripe event lands in the same
 * moment as `makeOrganizationFree` (which ends the organization's subscription, and Stripe then reports it canceled).
 */
export async function applySubscription(admin: Admin, organizationId: string, sub: Stripe.Subscription): Promise<{ error: string | null }> {
  const { error } = await admin.from("org_billing").update(billingFromSubscription(sub)).eq("organization_id", organizationId).neq("status", "complimentary");
  return { error: error?.message ?? null };
}

export type MakeFreeResult = { ok: true; cancelledSubscription: boolean } | { ok: false; error: string };

/**
 * Gives an organization a free account for good: any Stripe subscription it has is cancelled at once (no proration,
 * no final invoice; a trial has nothing to bill and a paid period is not refunded here), then its billing row is set
 * to `complimentary`. Stripe first, row second: if Stripe refuses, nothing changes and the reason comes back, so
 * the row can never say "free" while a subscription is still billing. A subscription Stripe no longer knows is
 * treated as already cancelled.
 */
export async function makeOrganizationFree(admin: Admin, organizationId: string): Promise<MakeFreeResult> {
  const { data: row, error: readError } = await admin.from("org_billing").select("stripe_subscription_id").eq("organization_id", organizationId).maybeSingle();
  if (readError) return { ok: false, error: readError.message };

  let cancelledSubscription = false;
  if (row?.stripe_subscription_id) {
    if (!isStripeConfigured()) return { ok: false, error: "Stripe isn't configured on this server, so its subscription can't be cancelled from here. Cancel it in the Stripe dashboard." };
    try {
      await getStripe().subscriptions.cancel(row.stripe_subscription_id, { prorate: false, invoice_now: false });
      cancelledSubscription = true;
    } catch (e) {
      if ((e as { code?: string }).code !== "resource_missing") return { ok: false, error: e instanceof Error ? e.message : "Stripe refused to cancel the subscription" };
    }
  }

  const { error } = await admin.from("org_billing").upsert(
    { organization_id: organizationId, status: "complimentary", stripe_subscription_id: null, plan_interval: null, current_period_end: null, cancel_at_period_end: false },
    { onConflict: "organization_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, cancelledSubscription };
}

/**
 * Asks Stripe for the organization's latest subscription and saves it. Run when the admin comes back from
 * checkout, so the page is right even before the webhook arrives.
 */
export async function syncOrgSubscription(admin: Admin, organizationId: string): Promise<void> {
  const { data: row } = await admin.from("org_billing").select("stripe_customer_id").eq("organization_id", organizationId).maybeSingle();
  if (!row?.stripe_customer_id) return;
  const subs = await getStripe().subscriptions.list({ customer: row.stripe_customer_id, status: "all", limit: 5 });
  const current = subs.data.find((s) => s.status !== "canceled" && s.status !== "incomplete_expired") ?? subs.data[0];
  if (current) await applySubscription(admin, organizationId, current);
}

/** The origin of the dashboard itself, `https://tapandlaunch.com` (or `http://localhost:…` in development). */
export function dashboardOrigin(rootDomain: string): string {
  const local = /^(localhost|127\.|\d{1,3}(\.\d{1,3}){3})/.test(rootDomain);
  return `${local ? "http" : "https"}://${rootDomain}`;
}
