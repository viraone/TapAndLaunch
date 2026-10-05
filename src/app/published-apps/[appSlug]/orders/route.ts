import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMember } from "@/lib/pwa/get-current-member";
import { recordAnalyticsEvent } from "@/lib/pwa/analytics";
import { canTakeCards, getStripeAccountRow } from "@/lib/stripe/accounts";
import { appOrigin, applicationFeeCents, buildCheckoutSessionParams, canPayByCard, safeReturnPath } from "@/lib/stripe/checkout";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getRootDomain } from "@/lib/tenant";

const OrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  /** Left out when the shopper pays by card: Stripe's checkout page asks for them. */
  customerName: z.string().min(1).max(200).optional(),
  customerEmail: z.string().email().optional(),
  /** The page the shopper bought from, so they come back to it after paying. */
  returnPath: z.string().optional(),
});

/**
 * Creates one order with one line item — see `ProductBuyRuntime`'s comment
 * on why this is "buy this product now," not a multi-item cart.
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

  const parsed = OrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: product } = await admin
    .from("products")
    .select("id, name, price_cents, currency, is_active")
    .eq("id", parsed.data.productId)
    .eq("app_id", published.app.id)
    .maybeSingle();

  if (!product || !product.is_active) {
    return Response.json({ error: "Product not available" }, { status: 400 });
  }

  const member = await getCurrentMember(published.app.id);
  const totalCents = product.price_cents * parsed.data.quantity;

  // Name and email are only optional when the shopper is about to pay on Stripe, which asks for them.
  const { customerName, customerEmail } = parsed.data;
  const hasContact = !!customerName && !!customerEmail;
  if (!hasContact && !(canPayByCard(totalCents) && (await canTakeCards(admin, published.app.organization_id)))) {
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
      total_cents: totalCents,
      currency: product.currency,
    })
    .select("id")
    .single();

  if (orderError) {
    return Response.json({ error: orderError.message }, { status: 400 });
  }

  const { error: itemError } = await admin.from("order_items").insert({
    order_id: order.id,
    product_id: product.id,
    product_name: product.name,
    unit_price_cents: product.price_cents,
    quantity: parsed.data.quantity,
  });

  if (itemError) {
    return Response.json({ error: itemError.message }, { status: 400 });
  }

  await recordAnalyticsEvent({
    appId: published.app.id,
    memberId: member?.id,
    eventType: "order_placed",
    metadata: { productId: product.id, quantity: parsed.data.quantity, totalCents },
  });

  const checkoutUrl = await startCardCheckout({
    admin,
    organizationId: published.app.organization_id,
    appId: published.app.id,
    appSlug,
    orderId: order.id,
    product,
    quantity: parsed.data.quantity,
    totalCents,
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
  product: { id: string; name: string; price_cents: number; currency: string };
  quantity: number;
  totalCents: number;
  customerEmail: string | undefined;
  returnPath: string;
}): Promise<string | null> {
  if (!isStripeConfigured() || !canPayByCard(input.totalCents)) return null;
  const account = await getStripeAccountRow(input.admin, input.organizationId);
  if (!account?.charges_enabled) return null;

  try {
    const session = await getStripe().checkout.sessions.create(
      buildCheckoutSessionParams({
        orderId: input.orderId,
        appId: input.appId,
        productId: input.product.id,
        productName: input.product.name,
        unitPriceCents: input.product.price_cents,
        currency: input.product.currency,
        quantity: input.quantity,
        customerEmail: input.customerEmail,
        origin: appOrigin(input.appSlug, getRootDomain()),
        returnPath: input.returnPath,
        feeCents: applicationFeeCents(input.totalCents, process.env.STRIPE_APPLICATION_FEE_PERCENT),
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
