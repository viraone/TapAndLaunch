import { describe, expect, it, vi } from "vitest";
import {
  createRefund,
  type RefundDeps,
  type RefundOrder,
  type RefundResult,
  type RefundRow,
  type RefundStore,
} from "./createRefund";

function baseOrder(over: Partial<RefundOrder> = {}): RefundOrder {
  return {
    id: "o1",
    app_id: "app_1",
    status: "fulfilled",
    payment_method: "stripe",
    currency: "usd",
    total_cents: 10000,
    refunded_cents: 0,
    stripe_payment_intent_id: "pi_1",
    stripe_checkout_session_id: "cs_1",
    stripe_subscription_id: null,
    ...over,
  };
}

type RefundInput = Parameters<typeof createRefund>[1];

function input(over: Partial<RefundInput> = {}): RefundInput {
  return {
    orderId: "o1",
    appId: "app_1",
    amountCents: 2500,
    reason: null,
    idempotencyKey: "key-1",
    userId: "user_1",
    userEmail: "owner@example.com",
    ...over,
  };
}

/** Real state, not a call log: the ledger the core reads back is the one it wrote. */
class FakeStore implements RefundStore {
  order: RefundOrder | null;
  refunds: RefundRow[] = [];
  notes: Array<{ orderId: string; body: string; userId: string; userEmail: string | null }> = [];
  failures: Array<{ id: string; message: string }> = [];
  calls: string[] = [];
  organizationId: string | null = "org_1";
  insertRace = false;
  reserveConflict = false;
  failNotes = false;
  failSetPaymentIntent = false;
  private nextId = 1;

  constructor(order: RefundOrder | null) {
    this.order = order;
  }

  async loadOrder(orderId: string, appId: string): Promise<RefundOrder | null> {
    this.calls.push("loadOrder");
    if (!this.order || this.order.id !== orderId || this.order.app_id !== appId) return null;
    // A snapshot, like a database read: later writes to the order must not leak into this call.
    return { ...this.order };
  }

  async organizationIdForApp(): Promise<string | null> {
    this.calls.push("organizationIdForApp");
    return this.organizationId;
  }

  async findRefund(orderId: string, idempotencyKey: string): Promise<RefundRow | null> {
    this.calls.push("findRefund");
    const row = this.refunds.find((r) => r.order_id === orderId && r.idempotency_key === idempotencyKey);
    return row ? { ...row } : null;
  }

  async insertPending(row: {
    orderId: string;
    idempotencyKey: string;
    amountCents: number;
    reason: string | null;
    userId: string;
    userEmail: string | null;
  }): Promise<RefundRow | null> {
    this.calls.push("insertPending");
    if (this.insertRace) return null;
    if (this.refunds.some((r) => r.order_id === row.orderId && r.idempotency_key === row.idempotencyKey)) {
      return null;
    }
    const inserted: RefundRow = {
      id: `refund_${this.nextId++}`,
      order_id: row.orderId,
      idempotency_key: row.idempotencyKey,
      stripe_refund_id: null,
      amount_cents: row.amountCents,
      reason: row.reason,
      status: "pending",
      created_at: "2026-11-01T00:00:00.000Z",
    };
    this.refunds.push(inserted);
    return { ...inserted };
  }

  async reserve(orderId: string, expectedRefundedCents: number, amountCents: number): Promise<boolean> {
    this.calls.push("reserve");
    if (this.reserveConflict) return false;
    if (!this.order || this.order.id !== orderId) return false;
    if (this.order.refunded_cents !== expectedRefundedCents) return false;
    this.order.refunded_cents = expectedRefundedCents + amountCents;
    return true;
  }

  async release(orderId: string, amountCents: number): Promise<void> {
    this.calls.push("release");
    if (!this.order || this.order.id !== orderId) return;
    this.order.refunded_cents = Math.max(0, this.order.refunded_cents - amountCents);
  }

  async setPaymentIntent(orderId: string, paymentIntentId: string): Promise<void> {
    this.calls.push("setPaymentIntent");
    if (this.failSetPaymentIntent) throw new Error("write failed");
    if (this.order && this.order.id === orderId && this.order.stripe_payment_intent_id === null) {
      this.order.stripe_payment_intent_id = paymentIntentId;
    }
  }

  async markSucceeded(refundRowId: string, stripeRefundId: string): Promise<void> {
    this.calls.push("markSucceeded");
    const row = this.refunds.find((r) => r.id === refundRowId);
    if (row) {
      row.status = "succeeded";
      row.stripe_refund_id = stripeRefundId;
    }
  }

  async markFailed(refundRowId: string, message: string): Promise<void> {
    this.calls.push("markFailed");
    const row = this.refunds.find((r) => r.id === refundRowId);
    if (row) row.status = "failed";
    this.failures.push({ id: refundRowId, message });
  }

  async markOrderRefunded(orderId: string): Promise<void> {
    this.calls.push("markOrderRefunded");
    if (!this.order || this.order.id !== orderId) return;
    if (
      (this.order.status === "paid" || this.order.status === "fulfilled") &&
      this.order.refunded_cents >= this.order.total_cents
    ) {
      this.order.status = "refunded";
    }
  }

  async addNote(orderId: string, body: string, userId: string, userEmail: string | null): Promise<void> {
    this.calls.push("addNote");
    if (this.failNotes) throw new Error("notes are down");
    this.notes.push({ orderId, body, userId, userEmail });
  }
}

function makeDeps(store: FakeStore, overrides: Partial<RefundDeps> = {}): RefundDeps {
  return {
    store,
    stripeAccountId: vi.fn<RefundDeps["stripeAccountId"]>(async () => "acct_1"),
    resolvePaymentIntent: vi.fn<RefundDeps["resolvePaymentIntent"]>(async () => null),
    createStripeRefund: vi.fn<RefundDeps["createStripeRefund"]>(async () => ({ id: "re_1" })),
    ...overrides,
  };
}

function expectOk(result: RefundResult): Extract<RefundResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected success, got ${result.code}: ${result.message}`);
  return result;
}

function expectFailure(result: RefundResult): Extract<RefundResult, { ok: false }> {
  if (result.ok) throw new Error("expected a failure");
  return result;
}

describe("createRefund", () => {
  it("refunds part of a paid order through the seller's Stripe account and records it", async () => {
    const store = new FakeStore(baseOrder());
    const createStripeRefund = vi.fn<RefundDeps["createStripeRefund"]>(async () => ({ id: "re_1" }));
    const deps = makeDeps(store, { createStripeRefund });

    const result = expectOk(await createRefund(deps, input()));

    expect(result.replay).toBe(false);
    expect(result.refundedCents).toBe(2500);
    expect(result.fullyRefunded).toBe(false);
    expect(result.refund).toMatchObject({
      id: "refund_1",
      order_id: "o1",
      idempotency_key: "key-1",
      amount_cents: 2500,
      status: "succeeded",
      stripe_refund_id: "re_1",
    });

    expect(createStripeRefund).toHaveBeenCalledTimes(1);
    expect(createStripeRefund).toHaveBeenCalledWith({
      paymentIntentId: "pi_1",
      amountCents: 2500,
      stripeAccountId: "acct_1",
      idempotencyKey: "refund:o1:key-1",
      metadata: { order_id: "o1", app_id: "app_1", refund_row_id: "refund_1" },
    });
    expect(deps.resolvePaymentIntent).not.toHaveBeenCalled();
    expect(store.order?.refunded_cents).toBe(2500);
    expect(store.order?.status).toBe("fulfilled");
    expect(store.notes).toEqual([
      { orderId: "o1", body: "Refunded $25.00", userId: "user_1", userEmail: "owner@example.com" },
    ]);
  });

  it("takes two partials and flips the order only on the one that completes it", async () => {
    const store = new FakeStore(baseOrder({ total_cents: 10000 }));
    const deps = makeDeps(store);

    const first = expectOk(await createRefund(deps, input({ amountCents: 3000, idempotencyKey: "k1" })));
    expect(first.refundedCents).toBe(3000);
    expect(first.fullyRefunded).toBe(false);
    expect(store.order?.status).toBe("fulfilled");
    expect(store.calls).not.toContain("markOrderRefunded");

    const second = expectOk(await createRefund(deps, input({ amountCents: 7000, idempotencyKey: "k2" })));
    expect(second.refundedCents).toBe(10000);
    expect(second.fullyRefunded).toBe(true);
    expect(store.order?.status).toBe("refunded");
    expect(store.notes.map((n) => n.body)).toEqual(["Refunded $30.00", "Refunded $70.00 (full refund)"]);

    // The same key again returns the finished refund and sends no money.
    store.calls.length = 0;
    const replay = expectOk(await createRefund(deps, input({ amountCents: 7000, idempotencyKey: "k2" })));
    expect(replay.replay).toBe(true);
    expect(replay.fullyRefunded).toBe(true);
    expect(replay.refundedCents).toBe(10000);
    expect(store.calls).toEqual(["loadOrder", "findRefund"]);
    expect(deps.createStripeRefund).toHaveBeenCalledTimes(2);
    expect(store.notes).toHaveLength(2);
  });

  it("puts the reason in the ledger row and the note", async () => {
    const store = new FakeStore(baseOrder({ total_cents: 10000 }));
    const deps = makeDeps(store);

    expectOk(await createRefund(deps, input({ amountCents: 10000, reason: "Damaged in transit" })));

    expect(store.refunds[0]?.reason).toBe("Damaged in transit");
    expect(store.notes[0]?.body).toBe("Refunded $100.00 — Damaged in transit (full refund)");
  });

  it.each([
    [0, "invalid_amount"],
    [-100, "invalid_amount"],
    [12.5, "invalid_amount"],
    ["2500", "invalid_amount"],
    [10001, "exceeds"],
  ])("refuses %j before touching money", async (amountCents, code) => {
    const store = new FakeStore(baseOrder());
    const deps = makeDeps(store);

    const result = expectFailure(await createRefund(deps, input({ amountCents: amountCents as unknown as number })));

    expect(result.code).toBe(code);
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
    expect(store.refunds).toHaveLength(0);
    expect(store.calls).toEqual(["loadOrder", "findRefund"]);
  });

  it("refuses one cent over the remaining amount and says the maximum", async () => {
    const store = new FakeStore(baseOrder({ total_cents: 2500 }));
    const deps = makeDeps(store);

    const result = expectFailure(await createRefund(deps, input({ amountCents: 2501 })));

    expect(result).toEqual({
      ok: false,
      code: "exceeds",
      message: "You can refund at most $25.00 on this order.",
    });
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it.each([
    ["pending", "This order has not been paid yet, so there is nothing to refund."],
    ["cancelled", "This order was cancelled, so there is nothing to refund."],
    ["refunded", "This order has already been refunded."],
  ])("refuses a %s order", async (status, message) => {
    const store = new FakeStore(baseOrder({ status }));
    const deps = makeDeps(store);

    const result = expectFailure(await createRefund(deps, input()));

    expect(result).toEqual({ ok: false, code: "not_refundable", message });
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("refuses a purchase request, which has no card payment", async () => {
    const store = new FakeStore(baseOrder({ payment_method: "request" }));
    const deps = makeDeps(store);

    expect(expectFailure(await createRefund(deps, input()))).toEqual({
      ok: false,
      code: "not_refundable",
      message: "This order was a purchase request, so there is no card payment to refund.",
    });
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("refuses a zero-decimal currency and points at the Stripe dashboard", async () => {
    const store = new FakeStore(baseOrder({ currency: "jpy" }));
    const deps = makeDeps(store);

    expect(expectFailure(await createRefund(deps, input()))).toEqual({
      ok: false,
      code: "not_refundable",
      message: "Orders in JPY have to be refunded in your Stripe dashboard.",
    });
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("accepts a supported currency in either case", async () => {
    const store = new FakeStore(baseOrder({ currency: "USD" }));
    expect(expectOk(await createRefund(makeDeps(store), input())).refundedCents).toBe(2500);
  });

  it("does not refund when the order is not ours", async () => {
    const store = new FakeStore(baseOrder());
    const deps = makeDeps(store);

    const result = expectFailure(await createRefund(deps, input({ appId: "another_app" })));
    expect(result).toEqual({ ok: false, code: "not_found", message: "That order could not be found." });
    expect(store.calls).toEqual(["loadOrder"]);
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("does not refund when the shop has no connected Stripe account", async () => {
    const store = new FakeStore(baseOrder());
    const stripeAccountId = vi.fn<RefundDeps["stripeAccountId"]>(async () => null);
    const deps = makeDeps(store, { stripeAccountId });

    expect(expectFailure(await createRefund(deps, input()))).toEqual({
      ok: false,
      code: "no_account",
      message: "This shop has not finished connecting Stripe, so it cannot send refunds yet.",
    });
    expect(stripeAccountId).toHaveBeenCalledWith("org_1");
    expect(store.refunds).toHaveLength(0);
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("does not look for a Stripe account when the app has no organization", async () => {
    const store = new FakeStore(baseOrder());
    store.organizationId = null;
    const stripeAccountId = vi.fn<RefundDeps["stripeAccountId"]>(async () => "acct_1");
    const deps = makeDeps(store, { stripeAccountId });

    expect(expectFailure(await createRefund(deps, input())).code).toBe("no_account");
    expect(stripeAccountId).not.toHaveBeenCalled();
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("says where to go when a subscription order's payment cannot be found", async () => {
    const store = new FakeStore(baseOrder({ stripe_payment_intent_id: null, stripe_subscription_id: "sub_1" }));
    const resolvePaymentIntent = vi.fn<RefundDeps["resolvePaymentIntent"]>(async () => null);
    const deps = makeDeps(store, { resolvePaymentIntent });

    expect(expectFailure(await createRefund(deps, input()))).toEqual({
      ok: false,
      code: "no_payment",
      message: "This order's payment could not be found in Stripe. Refund it in your Stripe dashboard.",
    });
    expect(resolvePaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ id: "o1" }), "acct_1");
    expect(store.refunds).toHaveLength(0);
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("finds a subscription order's payment intent, saves it, and refunds that", async () => {
    const store = new FakeStore(baseOrder({ stripe_payment_intent_id: null, stripe_subscription_id: "sub_1" }));
    const resolvePaymentIntent = vi.fn<RefundDeps["resolvePaymentIntent"]>(async () => "pi_from_invoice");
    const createStripeRefund = vi.fn<RefundDeps["createStripeRefund"]>(async () => ({ id: "re_2" }));
    const deps = makeDeps(store, { resolvePaymentIntent, createStripeRefund });

    const result = expectOk(await createRefund(deps, input()));

    expect(store.calls).toContain("setPaymentIntent");
    expect(store.order?.stripe_payment_intent_id).toBe("pi_from_invoice");
    expect(createStripeRefund).toHaveBeenCalledWith(expect.objectContaining({ paymentIntentId: "pi_from_invoice" }));
    expect(result.refund.stripe_refund_id).toBe("re_2");
  });

  it("still refunds when saving the found payment intent fails", async () => {
    const store = new FakeStore(baseOrder({ stripe_payment_intent_id: null, stripe_subscription_id: "sub_1" }));
    store.failSetPaymentIntent = true;
    const deps = makeDeps(store, {
      resolvePaymentIntent: vi.fn<RefundDeps["resolvePaymentIntent"]>(async () => "pi_from_invoice"),
    });

    expect(expectOk(await createRefund(deps, input())).refundedCents).toBe(2500);
  });

  it("puts the reserved cents back and records Stripe's reason when Stripe refuses", async () => {
    const store = new FakeStore(baseOrder());
    const createStripeRefund = vi.fn<RefundDeps["createStripeRefund"]>(async () => {
      throw new Error("Your card has expired.");
    });
    const deps = makeDeps(store, { createStripeRefund });

    const result = expectFailure(await createRefund(deps, input()));

    expect(result).toEqual({
      ok: false,
      code: "stripe_error",
      message: "Stripe refused the refund: Your card has expired.",
    });
    expect(store.order?.refunded_cents).toBe(0);
    expect(store.order?.status).toBe("fulfilled");
    expect(store.order?.total_cents).toBe(10000);
    expect(store.refunds[0]?.status).toBe("failed");
    expect(store.failures).toEqual([
      { id: "refund_1", message: "Stripe refused the refund: Your card has expired." },
    ]);
    expect(store.notes).toHaveLength(0);
    expect(store.calls).not.toContain("markSucceeded");
  });

  it.each([
    ["a dropped connection", { type: "StripeConnectionError", message: "socket hang up" }],
    ["a Stripe server error", { type: "StripeAPIError", message: "Internal error" }],
    ["a 503 answer", { statusCode: 503, message: "Service unavailable" }],
  ])("keeps the refund pending and the cents reserved after %s", async (_name, thrown) => {
    const store = new FakeStore(baseOrder());
    const createStripeRefund = vi.fn<RefundDeps["createStripeRefund"]>(async () => {
      throw thrown;
    });
    const deps = makeDeps(store, { createStripeRefund });

    const result = expectFailure(await createRefund(deps, input()));

    expect(result.code).toBe("processing");
    expect(result.message).toContain("cannot tell whether this refund went through");
    expect(store.order?.refunded_cents).toBe(2500);
    expect(store.refunds[0]?.status).toBe("pending");
    expect(store.calls).not.toContain("release");
    expect(store.calls).not.toContain("markFailed");

    // Trying again with the same key must not send a second refund.
    const again = expectFailure(await createRefund(deps, input()));
    expect(again.code).toBe("processing");
    expect(createStripeRefund).toHaveBeenCalledTimes(1);
  });

  it("still treats a card or request error as a definite failure", async () => {
    const store = new FakeStore(baseOrder());
    const createStripeRefund = vi.fn<RefundDeps["createStripeRefund"]>(async () => {
      throw { type: "StripeInvalidRequestError", statusCode: 400, message: "Charge ch_1 has already been refunded." };
    });
    const deps = makeDeps(store, { createStripeRefund });

    expect(expectFailure(await createRefund(deps, input())).code).toBe("stripe_error");
    expect(store.order?.refunded_cents).toBe(0);
  });

  it("says nothing it did not get from Stripe when the failure is not an Error", async () => {
    const store = new FakeStore(baseOrder());
    const createStripeRefund = vi.fn<RefundDeps["createStripeRefund"]>(async () => {
      throw { code: "something_internal", secret: "do not leak" };
    });
    const deps = makeDeps(store, { createStripeRefund });

    expect(expectFailure(await createRefund(deps, input()))).toEqual({
      ok: false,
      code: "stripe_error",
      message: "Stripe refused the refund. Nothing was sent back; check Stripe and try again.",
    });
  });

  it("stops before Stripe when another refund changed the order first", async () => {
    const store = new FakeStore(baseOrder());
    store.reserveConflict = true;
    const deps = makeDeps(store);

    const result = expectFailure(await createRefund(deps, input()));

    expect(result).toEqual({
      ok: false,
      code: "conflict",
      message: "This order changed while you were refunding it. Reload and try again.",
    });
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
    expect(store.refunds[0]?.status).toBe("failed");
    expect(store.failures).toEqual([{ id: "refund_1", message: "Another refund changed this order" }]);
    expect(store.order?.refunded_cents).toBe(0);
  });

  it("treats a second click with the same key while the first is pending as processing", async () => {
    const store = new FakeStore(baseOrder());
    store.refunds.push({
      id: "refund_pending",
      order_id: "o1",
      idempotency_key: "key-1",
      stripe_refund_id: null,
      amount_cents: 2500,
      reason: null,
      status: "pending",
      created_at: "2026-11-01T00:00:00.000Z",
    });
    const deps = makeDeps(store);

    expect(expectFailure(await createRefund(deps, input()))).toEqual({
      ok: false,
      code: "processing",
      message: "That refund is still being processed. Check Stripe before trying again.",
    });
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("asks for a new key when the old key's attempt already failed", async () => {
    const store = new FakeStore(baseOrder());
    store.refunds.push({
      id: "refund_failed",
      order_id: "o1",
      idempotency_key: "key-1",
      stripe_refund_id: null,
      amount_cents: 2500,
      reason: null,
      status: "failed",
      created_at: "2026-11-01T00:00:00.000Z",
    });
    const deps = makeDeps(store);

    expect(expectFailure(await createRefund(deps, input()))).toEqual({
      ok: false,
      code: "conflict",
      message: "That attempt already failed. Start a new refund.",
    });
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("does not talk to Stripe when a concurrent click inserted the row first", async () => {
    const store = new FakeStore(baseOrder());
    store.insertRace = true;
    const deps = makeDeps(store);

    expect(expectFailure(await createRefund(deps, input())).code).toBe("processing");
    expect(store.calls).not.toContain("reserve");
    expect(deps.createStripeRefund).not.toHaveBeenCalled();
  });

  it("still reports success when the note cannot be written", async () => {
    const store = new FakeStore(baseOrder());
    store.failNotes = true;
    const deps = makeDeps(store);

    const result = expectOk(await createRefund(deps, input()));

    expect(result.refundedCents).toBe(2500);
    expect(store.refunds[0]?.status).toBe("succeeded");
    expect(store.notes).toHaveLength(0);
  });

  it("writes the pending row and takes the reservation before talking to Stripe", async () => {
    const store = new FakeStore(baseOrder());
    const createStripeRefund = vi.fn<RefundDeps["createStripeRefund"]>(async () => {
      store.calls.push("stripe");
      return { id: "re_1" };
    });
    const deps = makeDeps(store, { createStripeRefund });

    expectOk(await createRefund(deps, input()));

    expect(store.calls).toEqual([
      "loadOrder",
      "findRefund",
      "organizationIdForApp",
      "insertPending",
      "reserve",
      "stripe",
      "markSucceeded",
      "addNote",
    ]);
  });
});
