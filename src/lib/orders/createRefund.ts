import { REFUND_CURRENCIES, refundableCents, validateRefundAmount } from "./refunds";

export type RefundOrder = {
  id: string;
  app_id: string;
  status: string;
  payment_method: string;
  currency: string;
  total_cents: number;
  refunded_cents: number;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_subscription_id: string | null;
};

export type RefundRow = {
  id: string;
  order_id: string;
  idempotency_key: string;
  stripe_refund_id: string | null;
  amount_cents: number;
  reason: string | null;
  status: "pending" | "succeeded" | "failed";
  created_at: string;
};

export interface RefundStore {
  loadOrder(orderId: string, appId: string): Promise<RefundOrder | null>;
  organizationIdForApp(appId: string): Promise<string | null>;
  findRefund(orderId: string, idempotencyKey: string): Promise<RefundRow | null>;
  /** Null when the unique (order_id, idempotency_key) already exists (a concurrent double click). */
  insertPending(row: {
    orderId: string;
    idempotencyKey: string;
    amountCents: number;
    reason: string | null;
    userId: string;
    userEmail: string | null;
  }): Promise<RefundRow | null>;
  /** True only when exactly one row changed, so two refunds can never both spend the same cents. */
  reserve(orderId: string, expectedRefundedCents: number, amountCents: number): Promise<boolean>;
  release(orderId: string, amountCents: number): Promise<void>;
  setPaymentIntent(orderId: string, paymentIntentId: string): Promise<void>;
  markSucceeded(refundRowId: string, stripeRefundId: string): Promise<void>;
  markFailed(refundRowId: string, message: string): Promise<void>;
  markOrderRefunded(orderId: string): Promise<void>;
  addNote(orderId: string, body: string, userId: string, userEmail: string | null): Promise<void>;
}

export type RefundDeps = {
  store: RefundStore;
  stripeAccountId(organizationId: string): Promise<string | null>;
  resolvePaymentIntent(order: RefundOrder, stripeAccountId: string): Promise<string | null>;
  createStripeRefund(args: {
    paymentIntentId: string;
    amountCents: number;
    stripeAccountId: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string }>;
};

export type RefundResult =
  | { ok: true; replay: boolean; refund: RefundRow; refundedCents: number; fullyRefunded: boolean }
  | {
      ok: false;
      code:
        | "not_found"
        | "not_refundable"
        | "invalid_amount"
        | "exceeds"
        | "no_payment"
        | "no_account"
        | "conflict"
        | "processing"
        | "stripe_error";
      message: string;
    };

const PROCESSING = "That refund is still being processed. Check Stripe before trying again.";
const UNCLEAR =
  "Stripe did not answer, so we cannot tell whether this refund went through. Check Stripe before trying again.";
const FAILED_ATTEMPT = "That attempt already failed. Start a new refund.";
const CHANGED = "This order changed while you were refunding it. Reload and try again.";
const NO_ACCOUNT = "This shop has not finished connecting Stripe, so it cannot send refunds yet.";
const NO_PAYMENT = "This order's payment could not be found in Stripe. Refund it in your Stripe dashboard.";

/**
 * Sends part or all of an order's money back through Stripe, keeping a ledger row for every
 * attempt and an optimistic lock on the order so two refunds can never spend the same cents.
 * Everything it talks to is injected, so the whole flow is tested without a database or Stripe.
 */
export async function createRefund(
  deps: RefundDeps,
  input: {
    orderId: string;
    appId: string;
    amountCents: number;
    reason: string | null;
    idempotencyKey: string;
    userId: string;
    userEmail: string | null;
  }
): Promise<RefundResult> {
  const order = await deps.store.loadOrder(input.orderId, input.appId);
  if (!order) return { ok: false, code: "not_found", message: "That order could not be found." };

  // A key already used returns its own result instead of sending the money twice.
  const existing = await deps.store.findRefund(order.id, input.idempotencyKey);
  if (existing) {
    if (existing.status === "succeeded") {
      return {
        ok: true,
        replay: true,
        refund: existing,
        refundedCents: order.refunded_cents,
        fullyRefunded: order.refunded_cents >= order.total_cents,
      };
    }
    if (existing.status === "pending") return { ok: false, code: "processing", message: PROCESSING };
    return { ok: false, code: "conflict", message: FAILED_ATTEMPT };
  }

  const notRefundable = whyNotRefundable(order);
  if (notRefundable) return { ok: false, code: "not_refundable", message: notRefundable };

  const amount = validateRefundAmount(input.amountCents, refundableCents(order));
  if (!amount.ok) return amount;

  const organizationId = await deps.store.organizationIdForApp(input.appId);
  const stripeAccountId = organizationId ? await deps.stripeAccountId(organizationId) : null;
  if (!stripeAccountId) return { ok: false, code: "no_account", message: NO_ACCOUNT };

  let paymentIntentId = order.stripe_payment_intent_id;
  if (!paymentIntentId) {
    const resolved = await deps.resolvePaymentIntent(order, stripeAccountId);
    if (!resolved) return { ok: false, code: "no_payment", message: NO_PAYMENT };
    paymentIntentId = resolved;
    // Remember it for next time. Finding it again from the invoice is harmless, so a failed
    // write here must not stop the refund.
    await quietly(() => deps.store.setPaymentIntent(order.id, resolved));
  }

  const row = await deps.store.insertPending({
    orderId: order.id,
    idempotencyKey: input.idempotencyKey,
    amountCents: amount.cents,
    reason: input.reason,
    userId: input.userId,
    userEmail: input.userEmail,
  });
  // Another click with the same key got its row in first.
  if (!row) return { ok: false, code: "processing", message: PROCESSING };

  const reserved = await deps.store.reserve(order.id, order.refunded_cents, amount.cents);
  if (!reserved) {
    await quietly(() => deps.store.markFailed(row.id, "Another refund changed this order"));
    return { ok: false, code: "conflict", message: CHANGED };
  }

  let stripeRefund: { id: string };
  try {
    stripeRefund = await deps.createStripeRefund({
      paymentIntentId,
      amountCents: amount.cents,
      stripeAccountId,
      idempotencyKey: `refund:${order.id}:${input.idempotencyKey}`,
      metadata: { order_id: order.id, app_id: order.app_id, refund_row_id: row.id },
    });
  } catch (error) {
    // A timeout or a Stripe server error does not tell us whether the money moved. Keep the
    // ledger row pending and the cents reserved: handing them back could let the same money be
    // refunded twice. The webhook still raises the order's total if the refund did go through.
    if (stripeAnswerUnclear(error)) return { ok: false, code: "processing", message: UNCLEAR };

    const message = stripeFailureMessage(error);
    // The Stripe answer is the one the caller needs; a bookkeeping write that fails while
    // tidying up must not replace it. The webhook's raise-only sync still knows the true total.
    await quietly(() => deps.store.release(order.id, amount.cents));
    await quietly(() => deps.store.markFailed(row.id, message));
    return { ok: false, code: "stripe_error", message };
  }

  await deps.store.markSucceeded(row.id, stripeRefund.id);

  const refundedCents = order.refunded_cents + amount.cents;
  const fullyRefunded = refundedCents >= order.total_cents;
  if (fullyRefunded) await deps.store.markOrderRefunded(order.id);

  const note = `Refunded ${dollars(amount.cents)}${input.reason ? ` — ${input.reason}` : ""}${fullyRefunded ? " (full refund)" : ""}`;
  try {
    await deps.store.addNote(order.id, note, input.userId, input.userEmail);
  } catch {
    // The money is already back; a missing note must never turn this into an error.
  }

  return {
    ok: true,
    replay: false,
    refund: { ...row, status: "succeeded", stripe_refund_id: stripeRefund.id },
    refundedCents,
    fullyRefunded,
  };
}

function whyNotRefundable(order: RefundOrder): string | null {
  if (order.payment_method !== "stripe") {
    return "This order was a purchase request, so there is no card payment to refund.";
  }

  if (order.status !== "paid" && order.status !== "fulfilled") {
    if (order.status === "refunded") return "This order has already been refunded.";
    if (order.status === "cancelled") return "This order was cancelled, so there is nothing to refund.";
    return "This order has not been paid yet, so there is nothing to refund.";
  }

  if (!(REFUND_CURRENCIES as readonly string[]).includes(order.currency.toLowerCase())) {
    return `Orders in ${order.currency.toUpperCase()} have to be refunded in your Stripe dashboard.`;
  }

  return null;
}

function stripeAnswerUnclear(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { type, statusCode } = error as { type?: unknown; statusCode?: unknown };
  return (
    type === "StripeConnectionError" ||
    type === "StripeAPIError" ||
    (typeof statusCode === "number" && statusCode >= 500)
  );
}

/** Stripe's own sentence when it gave one, and nothing else from the error object. */
function stripeFailureMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() !== "") {
      return `Stripe refused the refund: ${message.trim()}`;
    }
  }
  return "Stripe refused the refund. Nothing was sent back; check Stripe and try again.";
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function quietly(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    // Deliberately not surfaced; the caller already has the answer that matters.
  }
}
