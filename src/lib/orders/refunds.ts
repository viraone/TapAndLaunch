/**
 * The currencies a refund may be sent in. These are all two-decimal currencies, so
 * one cent is one hundredth of a unit in every one of them. Zero-decimal currencies
 * (JPY, KRW, …) are deliberately left out: their Stripe amount is not "cents", and
 * guessing how to convert a dollar box for them is how shops refund 100× too much.
 */
export const REFUND_CURRENCIES = [
  "usd",
  "cad",
  "eur",
  "gbp",
  "aud",
  "nzd",
  "chf",
  "sek",
  "nok",
  "dkk",
] as const;

/** The largest refund the amount box accepts, in cents (just under one million). */
const MAX_REFUND_CENTS = 99_999_999;

type RefundableOrder = { total_cents: number; refunded_cents: number; status: string };

/** How much of this order can still go back to the shopper, in cents. */
export function refundableCents(o: RefundableOrder): number {
  if (o.status !== "paid" && o.status !== "fulfilled") return 0;
  return Math.max(0, o.total_cents - o.refunded_cents);
}

/**
 * Turns what the merchant typed in a dollars box into whole cents. Accepts `12`,
 * `12.5`, `$12.50` and ` 1,200.50 `; rejects zero, negatives, more than two
 * decimal places, exponents and anything else that is not a plain amount.
 */
export function dollarsToCents(text: string): number | null {
  if (typeof text !== "string") return null;

  const match = /^\$?\s*(\d{1,3}(?:,\d{3})*|\d*)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;

  const whole = match[1] ?? "";
  const fraction = match[2];
  if (whole === "" && fraction === undefined) return null;

  const dollars = whole === "" ? 0 : Number(whole.replace(/,/g, ""));
  const cents = dollars * 100 + Number((fraction ?? "").padEnd(2, "0") || "0");

  if (cents <= 0 || cents > MAX_REFUND_CENTS) return null;
  return cents;
}

export type RefundAmountCheck =
  | { ok: true; cents: number }
  | { ok: false; code: "invalid_amount" | "exceeds"; message: string };

/** Checks a refund amount the caller already holds in cents against what is left on the order. */
export function validateRefundAmount(amountCents: unknown, refundable: number): RefundAmountCheck {
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0) {
    return {
      ok: false,
      code: "invalid_amount",
      message: "Enter a refund amount greater than zero, like 12.50.",
    };
  }

  if (amountCents > refundable) {
    return {
      ok: false,
      code: "exceeds",
      message: `You can refund at most $${(refundable / 100).toFixed(2)} on this order.`,
    };
  }

  return { ok: true, cents: amountCents };
}

/** True when some, but not all, of a refundable order has already gone back. */
export function partlyRefunded(o: RefundableOrder): boolean {
  if (o.status !== "paid" && o.status !== "fulfilled") return false;
  return o.refunded_cents > 0 && o.refunded_cents < o.total_cents;
}
