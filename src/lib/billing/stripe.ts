import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getStripe } from "@/lib/stripe/server";
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

async function customerFor(admin: Admin, organizationId: string, orgName: string, email: string | undefined): Promise<string> {
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

/** Saves a subscription's state on the organization's billing row. */
export async function applySubscription(admin: Admin, organizationId: string, sub: Stripe.Subscription): Promise<{ error: string | null }> {
  const { error } = await admin.from("org_billing").update(billingFromSubscription(sub)).eq("organization_id", organizationId);
  return { error: error?.message ?? null };
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
