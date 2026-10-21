import type Stripe from "stripe";
import type { ShippingRate } from "@/types/database";
import { cartHasSubscription, cartSubtotalCents, type CartLine } from "@/lib/store/cart";

/** Stripe refuses card payments under about 50 cents (USD); smaller orders stay as requests. */
export const MIN_CARD_CHARGE_CENTS = 50;

export function canPayByCard(totalCents: number): boolean {
  return totalCents >= MIN_CARD_CHARGE_CENTS;
}

/** The share of each sale TapAndLaunch keeps, from `STRIPE_APPLICATION_FEE_PERCENT` (default 0). */
export function applicationFeePercent(percentSetting: string | undefined): number {
  const percent = Number(percentSetting ?? 0);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 50) return 0;
  return percent;
}

/** That share of a one-time total, in whole cents. */
export function applicationFeeCents(totalCents: number, percentSetting: string | undefined): number {
  return Math.round((totalCents * applicationFeePercent(percentSetting)) / 100);
}

/** Only same-site paths: the shopper comes back to the page they bought from, never an outside address. */
export function safeReturnPath(path: unknown): string {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  return path.length > 200 ? "/" : path;
}

/** `https://{slug}.{root}` — `http` when the root is a local address. */
export function appOrigin(slug: string, rootDomain: string): string {
  // A local address: localhost or anything under it (`apps.localhost:3100`), or a plain IP address.
  const local = /(^|\.)localhost(:\d+)?$|^127\.|^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(rootDomain);
  return `${local ? "http" : "https"}://${slug}.${rootDomain}`;
}

function withParams(origin: string, path: string, params: Record<string, string>): string {
  const url = new URL(path, origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

export interface CheckoutInput {
  orderId: string;
  appId: string;
  currency: string;
  lines: CartLine[];
  /** Known email (the form was filled in); leave out to let Stripe's page ask for it. */
  customerEmail?: string;
  origin: string;
  returnPath: string;
  /** `STRIPE_APPLICATION_FEE_PERCENT`, applied as cents on a one-time order and as a percent on a subscription. */
  feePercentSetting: string | undefined;
  /** Stripe asks for an address and offers these rates; null means nothing ships. On a subscription
   * checkout Stripe allows no rate choice, so only the address is asked for — the caller has already
   * put the shipping charge in `lines` (see `subscriptionShippingLine`). */
  shipping: { rates: ShippingRate[]; countries: string[] } | null;
  /** Stripe Tax works out sales tax from the address (the connected account must have it set up). */
  automaticTax: boolean;
  /** Shows a "promotion code" field; codes are made in the merchant's Stripe dashboard. */
  promoCodes: boolean;
}

function shippingOption(rate: ShippingRate, currency: string): Stripe.Checkout.SessionCreateParams.ShippingOption {
  const estimate =
    rate.min_days !== undefined || rate.max_days !== undefined
      ? {
          delivery_estimate: {
            ...(rate.min_days !== undefined ? { minimum: { unit: "business_day" as const, value: rate.min_days } } : {}),
            ...(rate.max_days !== undefined ? { maximum: { unit: "business_day" as const, value: rate.max_days } } : {}),
          },
        }
      : {};
  return {
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: rate.name,
      fixed_amount: { amount: rate.amount_cents, currency },
      ...estimate,
    },
  };
}

/**
 * The whole cart as one hosted checkout, paid straight into the connected account. A cart with any
 * recurring product runs in subscription mode: Stripe starts the subscription and bills the one-time
 * items on its first invoice. Shipping, tax and promo codes are Stripe's page's job; what it charged
 * comes back on the order when it's paid (see `paidDetailsOf`).
 */
export function buildCheckoutSessionParams(i: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  const currency = i.currency.toLowerCase();
  const subscription = cartHasSubscription(i.lines);
  const feePercent = applicationFeePercent(i.feePercentSetting);
  const metadata = { order_id: i.orderId, app_id: i.appId };

  return {
    mode: subscription ? "subscription" : "payment",
    line_items: i.lines.map((l) => ({
      quantity: l.quantity,
      price_data: {
        currency,
        unit_amount: l.unitPriceCents,
        product_data: { name: l.name },
        ...(l.interval ? { recurring: { interval: l.interval } } : {}),
      },
    })),
    ...(i.customerEmail ? { customer_email: i.customerEmail } : {}),
    client_reference_id: i.orderId,
    metadata,
    ...(subscription
      ? {
          subscription_data: {
            metadata,
            ...(feePercent > 0 ? { application_fee_percent: feePercent } : {}),
          },
        }
      : {
          // Stripe emails the receipt (live mode only) when the payment carries the shopper's address.
          payment_intent_data: {
            ...(i.customerEmail ? { receipt_email: i.customerEmail } : {}),
            ...(feePercent > 0 ? { application_fee_amount: applicationFeeCents(cartSubtotalCents(i.lines), i.feePercentSetting) } : {}),
          },
        }),
    ...(i.shipping && i.shipping.rates.length > 0
      ? {
          shipping_address_collection: {
            allowed_countries: i.shipping.countries as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
          },
          ...(subscription ? {} : { shipping_options: i.shipping.rates.map((r) => shippingOption(r, currency)) }),
        }
      : {}),
    ...(i.automaticTax ? { automatic_tax: { enabled: true } } : {}),
    ...(i.promoCodes ? { allow_promotion_codes: true } : {}),
    success_url: withParams(i.origin, i.returnPath, { payment: "success", order: i.orderId }),
    cancel_url: withParams(i.origin, i.returnPath, { payment: "cancelled" }),
  };
}
