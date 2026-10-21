import type { BillingInterval, ShippingRate } from "@/types/database";

/** What the shopper asked for: product ids and how many of each. */
export interface CartRequest {
  productId: string;
  quantity: number;
}

/** A line the server has priced from the products table (or a shipping charge, which has no product). */
export interface CartLine {
  productId: string | null;
  name: string;
  unitPriceCents: number;
  quantity: number;
  interval: BillingInterval | null;
}

/** Stripe's limit on shipping choices per checkout. */
export const MAX_SHIPPING_RATES = 5;
/** Stripe's limit on line items per checkout is far higher; this keeps a cart sane. */
export const MAX_CART_LINES = 50;

/**
 * Collapses repeated product ids into one line each, dropping zero quantities. The old "buy this
 * product" form sent `{productId, quantity}`; a cart sends `items`. Both end up here.
 */
export function mergeCartRequests(items: CartRequest[]): CartRequest[] {
  const byId = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) continue;
    byId.set(item.productId, (byId.get(item.productId) ?? 0) + item.quantity);
  }
  return [...byId].map(([productId, quantity]) => ({ productId, quantity: Math.min(quantity, 999) }));
}

export function cartSubtotalCents(lines: Array<Pick<CartLine, "unitPriceCents" | "quantity">>): number {
  return lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
}

/** A cart with any recurring product checks out as a subscription (the one-time items join its first invoice). */
export function cartHasSubscription(lines: Array<Pick<CartLine, "interval">>): boolean {
  return lines.some((l) => l.interval !== null);
}

/**
 * Stripe offers a choice of shipping rates only on a one-time checkout. A subscription checkout
 * still collects the address, and the store's first rate rides along as a one-time line instead
 * (none when it's free), so the shopper sees and pays it the same way.
 */
export function subscriptionShippingLine(rates: ShippingRate[]): CartLine | null {
  const rate = rates[0];
  if (!rate || rate.amount_cents <= 0) return null;
  return { productId: null, name: `Shipping: ${rate.name}`, unitPriceCents: rate.amount_cents, quantity: 1, interval: null };
}

/** "$10.00", or "$10.00/month" for a recurring price. */
export function formatPrice(cents: number, currency: string, interval: BillingInterval | null = null): string {
  const money = new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  return interval ? `${money}/${interval}` : money;
}

/** Keeps only well-formed rates, at most Stripe's five. */
export function cleanShippingRates(rates: unknown): ShippingRate[] {
  if (!Array.isArray(rates)) return [];
  const out: ShippingRate[] = [];
  for (const r of rates) {
    if (!r || typeof r !== "object") continue;
    const { name, amount_cents, min_days, max_days } = r as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) continue;
    if (!Number.isInteger(amount_cents) || (amount_cents as number) < 0) continue;
    const rate: ShippingRate = { name: name.trim().slice(0, 100), amount_cents: amount_cents as number };
    if (Number.isInteger(min_days) && (min_days as number) >= 0) rate.min_days = min_days as number;
    if (Number.isInteger(max_days) && (max_days as number) >= (rate.min_days ?? 0)) rate.max_days = max_days as number;
    out.push(rate);
    if (out.length === MAX_SHIPPING_RATES) break;
  }
  return out;
}

/** Two-letter country codes, upper-cased and de-duplicated; empty when nothing valid was given. */
export function cleanCountries(codes: unknown): string[] {
  if (!Array.isArray(codes)) return [];
  const out = new Set<string>();
  for (const c of codes) {
    if (typeof c !== "string") continue;
    const code = c.trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) out.add(code);
  }
  return [...out];
}
