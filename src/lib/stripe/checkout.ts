import type Stripe from "stripe";

/** Stripe refuses card payments under about 50 cents (USD); smaller orders stay as requests. */
export const MIN_CARD_CHARGE_CENTS = 50;

export function canPayByCard(totalCents: number): boolean {
  return totalCents >= MIN_CARD_CHARGE_CENTS;
}

/** The part of each sale TapAndLaunch keeps, from `STRIPE_APPLICATION_FEE_PERCENT` (default 0). */
export function applicationFeeCents(totalCents: number, percentSetting: string | undefined): number {
  const percent = Number(percentSetting ?? 0);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 50) return 0;
  return Math.round((totalCents * percent) / 100);
}

/** Only same-site paths: the shopper comes back to the page they bought from, never an outside address. */
export function safeReturnPath(path: unknown): string {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  return path.length > 200 ? "/" : path;
}

/** `https://{slug}.{root}` — `http` when the root is a local address. */
export function appOrigin(slug: string, rootDomain: string): string {
  const local = /^(localhost|127\.|\d{1,3}(\.\d{1,3}){3})/.test(rootDomain);
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
  productId: string;
  productName: string;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  /** Known email (the form was filled in); leave out to let Stripe's page ask for it. */
  customerEmail?: string;
  origin: string;
  returnPath: string;
  feeCents: number;
}

/** One line item, hosted checkout, paid straight into the connected account. */
export function buildCheckoutSessionParams(i: CheckoutInput): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    line_items: [
      {
        quantity: i.quantity,
        price_data: {
          currency: i.currency.toLowerCase(),
          unit_amount: i.unitPriceCents,
          product_data: { name: i.productName },
        },
      },
    ],
    ...(i.customerEmail ? { customer_email: i.customerEmail } : {}),
    client_reference_id: i.orderId,
    metadata: { order_id: i.orderId, app_id: i.appId },
    // Stripe emails the receipt (live mode only) when the payment carries the shopper's address.
    payment_intent_data: {
      ...(i.customerEmail ? { receipt_email: i.customerEmail } : {}),
      ...(i.feeCents > 0 ? { application_fee_amount: i.feeCents } : {}),
    },
    success_url: withParams(i.origin, i.returnPath, { payment: "success", order: i.orderId, product: i.productId }),
    cancel_url: withParams(i.origin, i.returnPath, { payment: "cancelled" }),
  };
}
