import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { customerFor } from "@/lib/billing/stripe";
import { checkAvailability, isNameSiloConfigured, registerDomain } from "./namesilo";
import { isBuyableDomain, searchCandidates } from "./buy";
import { attachDomain } from "./attach";

type Admin = SupabaseClient<Database>;
export type DomainOrderRow = Database["public"]["Tables"]["domain_orders"]["Row"];

/**
 * Buying a domain from the Domain tab. The customer searches, sees the registrar's price, pays it through Stripe
 * Checkout (one payment, on our own account), and the domain is registered in the platform's NameSilo account, then
 * attached to the app the same way a typed domain is. Every step is recorded on a `domain_orders` row.
 *
 * Money and the registrar are both outside our database, so fulfilment is written to be safe to run twice: the page
 * the customer comes back to and Stripe's webhook both call `fulfillDomainOrder`, and only the one that flips the
 * row from `pending` to `paid` registers the domain.
 */

export interface DomainOffer {
  domain: string;
  available: boolean;
  priceCents: number | null;
  renewCents: number | null;
}

/** Buying needs both the registrar key and Stripe; without either the tab offers connecting a domain only. */
export function canBuyDomains(): boolean {
  return isNameSiloConfigured() && isStripeConfigured();
}

/** Prices the typed name with each ending we sell. A premium name is shown as taken: its price is not the normal one. */
export async function searchDomains(query: string): Promise<{ offers: DomainOffer[]; error?: string }> {
  const candidates = searchCandidates(query);
  if (candidates.length === 0) return { offers: [], error: "Type a name, like costumecontestsseattle" };
  const { results, error } = await checkAvailability(candidates);
  if (error) return { offers: [], error };
  return {
    offers: candidates.map((domain) => {
      const r = results.find((x) => x.domain === domain);
      const available = !!r?.available && !r.premium && r.priceCents != null && r.renewCents != null;
      return { domain, available, priceCents: available ? r!.priceCents : null, renewCents: available ? r!.renewCents : null };
    }),
  };
}

/** Opens Stripe Checkout for one domain, one year, at the registrar's price as of right now. Returns Stripe's page. */
export async function startDomainCheckout(input: {
  admin: Admin;
  appId: string;
  organizationId: string;
  orgName: string;
  email: string | undefined;
  domain: string;
  origin: string;
}): Promise<{ url: string } | { error: string }> {
  const domain = input.domain.trim().toLowerCase();
  if (!isBuyableDomain(domain)) return { error: "That isn't a domain we can register here. Try a .com, .net or .org name." };

  // Priced again at checkout, not from what the search showed: availability and prices change under us.
  const { results, error } = await checkAvailability([domain]);
  const offer = results.find((r) => r.domain === domain);
  if (error) return { error };
  if (!offer?.available || offer.premium || offer.priceCents == null || offer.renewCents == null) return { error: `${domain} is not available any more` };

  const { data: order, error: insertError } = await input.admin
    .from("domain_orders")
    .insert({
      organization_id: input.organizationId,
      app_id: input.appId,
      domain,
      years: 1,
      price_cents: offer.priceCents,
      renew_cents: offer.renewCents,
      currency: "usd",
      status: "pending",
    })
    .select("*")
    .single();
  if (insertError || !order) return { error: insertError?.message ?? "Could not start the purchase" };

  const customer = await customerFor(input.admin, input.organizationId, input.orgName, input.email);
  const builder = `${input.origin}/dashboard/apps/${input.appId}/builder`;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer,
    // Payment methods come from the Stripe dashboard's settings. A bank-style method pays later: the session then
    // completes `unpaid`, nothing is registered yet, and the webhook's async_payment_succeeded finishes the job.
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: offer.priceCents,
          product_data: {
            name: `${domain} (domain, 1 year)`,
            description: "Registered for you and connected to your site. Includes privacy for your contact details.",
          },
        },
      },
    ],
    client_reference_id: order.id,
    metadata: { domain_order_id: order.id, app_id: input.appId, organization_id: input.organizationId, domain },
    payment_intent_data: { description: `Domain ${domain}, 1 year`, ...(input.email ? { receipt_email: input.email } : {}) },
    success_url: `${builder}?domain=success&order=${order.id}`,
    cancel_url: `${builder}?domain=cancelled&order=${order.id}`,
  });
  if (!session.url) return { error: "Stripe returned no checkout page" };

  await input.admin.from("domain_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
  return { url: session.url };
}

/**
 * Finishes a purchase once Stripe has the money: registers the domain, then attaches it to the app. Safe to call more
 * than once and from two places at the same time (see the note at the top). Returns the row as it stands afterwards:
 * `registered` with `error` set means the domain is bought but could not be connected (the tab offers "Connect it").
 */
export async function fulfillDomainOrder(admin: Admin, orderId: string): Promise<DomainOrderRow | null> {
  const { data: order } = await admin.from("domain_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "pending" || !order.stripe_session_id) return order;

  const session = await getStripe().checkout.sessions.retrieve(order.stripe_session_id);
  if (session.payment_status !== "paid") return order;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  // Claim the order: the update only matches while it is still pending, so a second caller gets nothing back and
  // leaves the registering to the first.
  const { data: claimed } = await admin
    .from("domain_orders")
    .update({ status: "paid", stripe_payment_intent_id: paymentIntentId })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (!claimed) return (await admin.from("domain_orders").select("*").eq("id", orderId).maybeSingle()).data;

  const registration = await registerDomain(order.domain, order.years);
  if (!registration.ok) {
    console.error(`domain registration failed for ${order.domain}: ${registration.error}`);
    const { data } = await admin.from("domain_orders").update({ status: "failed", error: registration.error }).eq("id", orderId).select("*").single();
    return data;
  }

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + order.years);
  await admin.from("domain_orders").update({ status: "registered", expires_at: expires.toISOString().slice(0, 10), error: null }).eq("id", orderId);

  // Attached with the service-role client: the purchase itself was the authorization.
  const attached = await attachDomain(admin, order.app_id, order.domain);
  const note =
    "error" in attached
      ? `Registered, but it could not be connected yet: ${attached.error}`
      : attached.dns === "failed"
        ? `Connected, but its DNS could not be set for you: ${attached.dnsError ?? "unknown reason"}`
        : null;
  const { data } = await admin.from("domain_orders").update({ error: note }).eq("id", orderId).select("*").single();
  return data;
}

/** A checkout that was closed or expired: the row says so, and nothing was charged. Paid orders are left alone. */
export async function cancelDomainOrder(admin: Admin, orderId: string): Promise<DomainOrderRow | null> {
  await admin.from("domain_orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending");
  return (await admin.from("domain_orders").select("*").eq("id", orderId).maybeSingle()).data;
}
