import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/pwa/get-current-member";
import { recordAnalyticsEvent } from "@/lib/pwa/analytics";
import { getStoreSettings, type StoreSettings } from "@/lib/pwa/commerce";
import { canTakeCards, getStripeAccountRow } from "@/lib/stripe/accounts";
import { appOrigin, buildCheckoutSessionParams, canPayByCard, safeReturnPath } from "@/lib/stripe/checkout";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getRootDomain } from "@/lib/tenant";
import { MAX_CART_LINES, cartHasSubscription, cartSubtotalCents, mergeCartRequests, subscriptionShippingLine, type CartLine } from "@/lib/store/cart";

const ItemSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(999) });

const OrderSchema = z
  .object({
    /** The cart. */
    items: z.array(ItemSchema).min(1).max(MAX_CART_LINES).optional(),
    /** The old one-product form (a site installed before the cart may still send this). */
    productId: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(999).optional(),
    /** Left out when the shopper pays by card: Stripe's checkout page asks for them. */
    customerName: z.string().min(1).max(200).optional(),
    customerEmail: z.string().email().optional(),
    /** The page the shopper bought from, so they come back to it after paying. */
    returnPath: z.string().optional(),
  })
  .refine((o) => (o.items && o.items.length > 0) || o.productId, { message: "Nothing in the cart" });

/**
 * Creates one order for the whole cart (one line per product).
 *
 * If the app's organization has connected Stripe (and the order is big enough
 * for a card), the response carries a `checkoutUrl` on Stripe's hosted page and
 * the order stays `pending` until the webhook marks it `paid`. Otherwise this
 * records a purchase *request* for the merchant to follow up on by hand.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = OrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const requested = mergeCartRequests(parsed.data.items ?? [{ productId: parsed.data.productId!, quantity: parsed.data.quantity ?? 1 }]);
  if (requested.length === 0) return Response.json({ error: "Nothing in the cart" }, { status: 400 });

  const admin = createAdminClient();

  const { data: products } = await admin
    .from("products")
    .select("id, name, price_cents, currency, is_active, billing_interval")
    .eq("app_id", published.app.id)
    .in(
      "id",
      requested.map((r) => r.productId)
    );

  const byId = new Map((products ?? []).filter((p) => p.is_active).map((p) => [p.id, p]));
  const lines: CartLine[] = [];
  const currencies = new Set<string>();
  for (const r of requested) {
    const p = byId.get(r.productId);
    if (!p) return Response.json({ error: "A product in the cart is no longer available." }, { status: 400 });
    lines.push({ productId: p.id, name: p.name, unitPriceCents: p.price_cents, quantity: r.quantity, interval: p.billing_interval });
    currencies.add(p.currency);
  }
  if (currencies.size !== 1) {
    return Response.json({ error: "These products can't be bought together." }, { status: 400 });
  }
  const [currency] = currencies;

  // A subscription checkout can't offer shipping rates on Stripe's page, so the charge becomes a line of its own.
  const settings = await getStoreSettings(published.app.id);
  if (settings.shipping_enabled && cartHasSubscription(lines)) {
    const shippingLine = subscriptionShippingLine(settings.shipping_rates);
    if (shippingLine) lines.push(shippingLine);
  }

  const member = await getCurrentMember(published.app.id);
  const subtotalCents = cartSubtotalCents(lines);

  // Name and email are only optional when the shopper is about to pay on Stripe, which asks for them.
  const { customerName, customerEmail } = parsed.data;
  const hasContact = !!customerName && !!customerEmail;
  if (!hasContact && !(canPayByCard(subtotalCents) && (await canTakeCards(admin, published.app.organization_id)))) {
    return Response.json({ error: "Please enter your name and email." }, { status: 400 });
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      app_id: published.app.id,
      member_id: member?.id ?? null,
      // Blank until Stripe tells us who paid (see `markOrderPaid`).
      customer_name: customerName ?? "",
      customer_email: customerEmail ?? "",
      // The items only; shipping, tax and discounts come from Stripe once paid.
      total_cents: subtotalCents,
      currency,
    })
    .select("id")
    .single();

  if (orderError) {
    return Response.json({ error: orderError.message }, { status: 400 });
  }

  const { error: itemError } = await admin.from("order_items").insert(
    lines.map((l) => ({
      order_id: order.id,
      product_id: l.productId,
      product_name: l.name,
      unit_price_cents: l.unitPriceCents,
      quantity: l.quantity,
      billing_interval: l.interval,
    }))
  );

  if (itemError) {
    return Response.json({ error: itemError.message }, { status: 400 });
  }

  await recordAnalyticsEvent({
    appId: published.app.id,
    memberId: member?.id,
    eventType: "order_placed",
    metadata: { items: lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: l.quantity })), totalCents: subtotalCents },
  });

  const checkoutUrl = await startCardCheckout({
    admin,
    organizationId: published.app.organization_id,
    appId: published.app.id,
    appSlug,
    orderId: order.id,
    lines,
    currency,
    subtotalCents,
    settings,
    customerEmail,
    returnPath: safeReturnPath(parsed.data.returnPath),
  });

  // Without a form there's no way to reach this shopper, so a checkout that didn't open is a failure, not a request.
  if (!checkoutUrl && !hasContact) {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return Response.json({ error: "Checkout is unavailable right now. Please try again." }, { status: 502 });
  }

  return Response.json({ orderId: order.id, checkoutUrl }, { status: 201 });
}

/**
 * Opens a Stripe Checkout session on the merchant's connected account and returns its URL, or
 * `null` to fall back to the request flow (Stripe off, account not ready, tiny order, or a Stripe
 * error — the order is already saved, so the merchant still hears about it).
 */
async function startCardCheckout(input: {
  admin: ReturnType<typeof createAdminClient>;
  organizationId: string;
  appId: string;
  appSlug: string;
  orderId: string;
  lines: CartLine[];
  currency: string;
  subtotalCents: number;
  settings: StoreSettings;
  customerEmail: string | undefined;
  returnPath: string;
}): Promise<string | null> {
  if (!isStripeConfigured() || !canPayByCard(input.subtotalCents)) return null;
  const account = await getStripeAccountRow(input.admin, input.organizationId);
  if (!account?.charges_enabled) return null;
  const { settings } = input;

  try {
    const session = await getStripe().checkout.sessions.create(
      buildCheckoutSessionParams({
        orderId: input.orderId,
        appId: input.appId,
        currency: input.currency,
        lines: input.lines,
        customerEmail: input.customerEmail,
        origin: appOrigin(input.appSlug, getRootDomain()),
        returnPath: input.returnPath,
        feePercentSetting: process.env.STRIPE_APPLICATION_FEE_PERCENT,
        shipping: settings.shipping_enabled ? { rates: settings.shipping_rates, countries: settings.ship_to_countries } : null,
        automaticTax: settings.tax_enabled,
        promoCodes: settings.promo_codes_enabled,
      }),
      { stripeAccount: account.stripe_account_id }
    );
    if (!session.url) return null;
    await input.admin
      .from("orders")
      .update({ payment_method: "stripe", stripe_checkout_session_id: session.id })
      .eq("id", input.orderId);
    return session.url;
  } catch (error) {
    console.error("stripe checkout failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
