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
 * Buying a domain on TapAndLaunch. The customer searches (tapandlaunch.com/domains, or a site's Domain tab), sees the
 * registrar's price, pays it through Stripe Checkout (one payment, on our own account), and the domain is registered in
 * the platform's NameSilo account. Bought from a site's Domain tab it is attached to that site at once; bought on its
 * own it waits in Dashboard > Domains until the customer connects it. Every step is recorded on a `domain_orders` row.
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

/**
 * Opens Stripe Checkout for one domain, one year, at the registrar's price as of right now. Returns Stripe's page.
 * With `appId` the domain is for that site and Stripe returns to its builder; without, it is bought on its own and
 * Stripe returns to Dashboard > Domains.
 */
export async function startDomainCheckout(input: {
  admin: Admin;
  appId: string | null;
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

  // Already bought here (by anyone): the registrar would refuse too, but say so before taking money.
  const { data: owned } = await input.admin.from("domain_orders").select("id").eq("domain", domain).in("status", ["paid", "registered"]).limit(1).maybeSingle();
  if (owned) return { error: `${domain} is already registered through TapAndLaunch` };

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
  const back = input.appId ? `${input.origin}/dashboard/apps/${input.appId}/builder` : `${input.origin}/dashboard/domains`;
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
            description: input.appId
              ? "Registered for you and connected to your site. Includes privacy for your contact details."
              : "Registered for you, ready to connect to any of your TapAndLaunch sites. Includes privacy for your contact details.",
          },
        },
      },
    ],
    client_reference_id: order.id,
    metadata: { domain_order_id: order.id, app_id: input.appId ?? "", organization_id: input.organizationId, domain },
    payment_intent_data: { description: `Domain ${domain}, 1 year`, ...(input.email ? { receipt_email: input.email } : {}) },
    success_url: `${back}?domain=success&order=${order.id}`,
    cancel_url: `${back}?domain=cancelled&order=${order.id}`,
  });
  if (!session.url) return { error: "Stripe returned no checkout page" };

  await input.admin.from("domain_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
  return { url: session.url };
}

/**
 * Finishes a purchase once Stripe has the money: registers the domain, then attaches it to the site when the order
 * names one. Safe to call more than once and from two places at the same time (see the note at the top). Returns the
 * row as it stands afterwards: `registered` with `error` set means the domain is bought but could not be connected
 * (the Domain tab and Dashboard > Domains offer "Connect").
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
  if (!claimed) return rereadOrder(admin, orderId);

  const registration = await registerDomain(order.domain, order.years);
  if (!registration.ok) {
    console.error(`domain registration failed for ${order.domain}: ${registration.error}`);
    const { data } = await admin.from("domain_orders").update({ status: "failed", error: registration.error }).eq("id", orderId).select("*").single();
    return data;
  }

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + order.years);
  await admin.from("domain_orders").update({ status: "registered", expires_at: expires.toISOString().slice(0, 10), error: null }).eq("id", orderId);
  if (!order.app_id) return rereadOrder(admin, orderId);

  // Attached with the service-role client: the purchase itself was the authorization.
  const note = attachNote(await attachDomain(admin, order.app_id, order.domain));
  const { data } = await admin.from("domain_orders").update({ error: note }).eq("id", orderId).select("*").single();
  return data;
}

function attachNote(attached: Awaited<ReturnType<typeof attachDomain>>): string | null {
  if ("error" in attached) return `Registered, but it could not be connected yet: ${attached.error}`;
  if (attached.dns === "failed") return `Connected, but its DNS could not be set for you: ${attached.dnsError ?? "unknown reason"}`;
  return null;
}

/**
 * Connects a domain the organization owns (a `registered` order) to one of its sites: records the site on the order,
 * then attaches it like a typed domain. `db` is the signed-in user's client, so the app write obeys RLS; the order
 * write uses the service role. The caller checks the user may edit the app.
 */
export async function connectDomainOrder(db: SupabaseClient<Database>, admin: Admin, orderId: string, appId: string): Promise<{ order: DomainOrderRow; app: Database["public"]["Tables"]["apps"]["Row"] } | { error: string }> {
  const { data: order } = await admin.from("domain_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order || order.status !== "registered") return { error: "That domain isn't registered yet" };
  const { data: app } = await db.from("apps").select("id, organization_id, custom_domain").eq("id", appId).maybeSingle();
  if (!app || app.organization_id !== order.organization_id) return { error: "Not found" };
  if (order.app_id && order.app_id !== appId) {
    const { data: other } = await admin.from("apps").select("custom_domain").eq("id", order.app_id).maybeSingle();
    if (other?.custom_domain === order.domain) return { error: "That domain is connected to another of your sites. Disconnect it there first." };
  }
  if (app.custom_domain && app.custom_domain !== order.domain) return { error: "This site already has a custom domain. Remove it first." };

  const attached = await attachDomain(db, appId, order.domain);
  if ("error" in attached) return { error: attached.error };
  const { data: updated } = await admin.from("domain_orders").update({ app_id: appId, error: attachNote(attached) }).eq("id", orderId).select("*").single();
  return { order: updated ?? { ...order, app_id: appId }, app: attached.app };
}

/** A checkout that was closed or expired: the row says so, and nothing was charged. Paid orders are left alone. */
export async function cancelDomainOrder(admin: Admin, orderId: string): Promise<DomainOrderRow | null> {
  await admin.from("domain_orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending");
  return rereadOrder(admin, orderId);
}

/**
 * The order as it stands now. Next memoizes identical GET requests within one page render, and the first read of the
 * order happened at the top of the same render, so a plain repeat of that query would hand back the row as it was
 * before anything was written (the return page then said "Payment not confirmed yet" about a registered domain).
 * Asking for the count too makes it a different request.
 */
async function rereadOrder(admin: Admin, orderId: string): Promise<DomainOrderRow | null> {
  return (await admin.from("domain_orders").select("*", { count: "exact" }).eq("id", orderId).maybeSingle()).data;
}
