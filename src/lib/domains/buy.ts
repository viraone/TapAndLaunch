/**
 * Buying a domain from the Domain tab: the small, pure parts, shared by the server (`purchase.ts`) and the builder.
 * The registrar is NameSilo (`namesilo.ts`); the customer pays the registrar's own price through Stripe.
 */

/** The endings a customer can buy here. Others are priced differently, or need paperwork, and go by hand. */
export const BUYABLE_TLDS = ["com", "net", "org"] as const;
export type BuyableTld = (typeof BUYABLE_TLDS)[number];

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/**
 * The name part of what the customer typed: `Costume Contests Seattle` and `costumecontestsseattle.com` both give
 * `costumecontestsseattle`. Spaces and anything else that can't be in a domain are dropped; `www.` is dropped too.
 */
export function searchLabel(input: string): string {
  const text = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  const base = text.includes(".") ? text.slice(0, text.indexOf(".")) : text;
  return base.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 63);
}

/** The ending the customer typed, when it is one we sell; nothing for `brand` or `brand.io`. */
export function typedTld(input: string): BuyableTld | null {
  const text = input.trim().toLowerCase();
  const dot = text.lastIndexOf(".");
  if (dot < 0) return null;
  const tld = text.slice(dot + 1).replace(/[^a-z]/g, "");
  return (BUYABLE_TLDS as readonly string[]).includes(tld) ? (tld as BuyableTld) : null;
}

/** The domains to price for a search, the ending the customer typed first (or `.com`), then the other two. */
export function searchCandidates(input: string): string[] {
  const label = searchLabel(input);
  if (!LABEL.test(label)) return [];
  const first = typedTld(input) ?? "com";
  const order = [first, ...BUYABLE_TLDS.filter((t) => t !== first)];
  return order.map((tld) => `${label}.${tld}`);
}

/** `brand.com` with an ending we sell: exactly one label, no subdomain. Anything else can only be connected, not bought. */
export function isBuyableDomain(domain: string): boolean {
  const parts = domain.trim().toLowerCase().split(".");
  if (parts.length !== 2) return false;
  const [label, tld] = parts;
  return LABEL.test(label ?? "") && (BUYABLE_TLDS as readonly string[]).includes(tld ?? "");
}

export function moneyLabel(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/** "$17.29 a year", or "$10.79 for the first year, then $14.99 a year" when the renewal differs. */
export function priceLabel(priceCents: number, renewCents: number, currency = "usd"): string {
  const price = moneyLabel(priceCents, currency);
  if (renewCents === priceCents) return `${price} a year`;
  return `${price} for the first year, then ${moneyLabel(renewCents, currency)} a year`;
}
