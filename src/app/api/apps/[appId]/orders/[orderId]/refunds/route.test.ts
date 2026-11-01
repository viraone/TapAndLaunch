import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "user_1", email: "owner@example.com" } as { id: string; email: string | null } | null,
  editor: true,
  stripeConfigured: true,
  result: null as unknown,
  throwMessage: null as string | null,
  inputs: [] as Array<{ deps: unknown; input: Record<string, unknown> }>,
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/org", () => ({ isAppEditor: async () => state.editor }));
vi.mock("@/lib/stripe/server", () => ({
  isStripeConfigured: () => state.stripeConfigured,
  getStripe: () => ({}),
}));
vi.mock("@/lib/orders/createRefund", () => ({
  createRefund: async (deps: unknown, input: Record<string, unknown>) => {
    state.inputs.push({ deps, input });
    if (state.throwMessage) throw new Error(state.throwMessage);
    return state.result;
  },
}));

import { POST } from "./route";

const validBody = {
  amount_cents: 2500,
  reason: "Damaged box",
  idempotency_key: "refund-key-1",
};

function refundRow() {
  return {
    id: "refund_1",
    order_id: "order_1",
    idempotency_key: "refund-key-1",
    stripe_refund_id: "re_1",
    amount_cents: 2500,
    reason: "Damaged box",
    status: "succeeded",
    created_at: "2026-11-01T10:00:00.000Z",
  };
}

function post(body: unknown = validBody) {
  return POST(
    new Request("http://localhost/api/apps/app_1/orders/order_1/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ appId: "app_1", orderId: "order_1" }) }
  );
}

beforeEach(() => {
  state.user = { id: "user_1", email: "owner@example.com" };
  state.editor = true;
  state.stripeConfigured = true;
  state.throwMessage = null;
  state.inputs.length = 0;
  state.result = {
    ok: true,
    replay: false,
    refund: refundRow(),
    refundedCents: 2500,
    fullyRefunded: false,
  };
});

describe("POST order refunds", () => {
  it("401s when signed out", async () => {
    state.user = null;

    const response = await post();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
    expect(state.inputs).toHaveLength(0);
  });

  it("403s when the user is not an editor", async () => {
    state.editor = false;

    const response = await post();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Not authorized" });
    expect(state.inputs).toHaveLength(0);
  });

  it("503s when Stripe is not set up", async () => {
    state.stripeConfigured = false;

    const response = await post();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Payments are not set up on this server." });
    expect(state.inputs).toHaveLength(0);
  });

  it.each([
    ["an empty body", {}],
    ["a zero amount", { ...validBody, amount_cents: 0 }],
    ["a fractional amount", { ...validBody, amount_cents: 12.5 }],
    ["an oversized amount", { ...validBody, amount_cents: 100_000_000 }],
    ["a missing key", { ...validBody, idempotency_key: undefined }],
    ["a bad key", { ...validBody, idempotency_key: "short" }],
    ["an oversized reason", { ...validBody, reason: "x".repeat(201) }],
  ])("400s on %s", async (_label, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBeTruthy();
    expect(state.inputs).toHaveLength(0);
  });

  it("400s on malformed JSON", async () => {
    const response = await post("{not json");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid input" });
  });

  it.each([
    ["not_found", 404],
    ["invalid_amount", 400],
    ["exceeds", 400],
    ["not_refundable", 409],
    ["conflict", 409],
    ["processing", 409],
    ["no_payment", 422],
    ["no_account", 422],
    ["stripe_error", 502],
  ] as const)("maps %s to %i", async (code, status) => {
    state.result = { ok: false, code, message: `${code} happened` };

    const response = await post();

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: `${code} happened`, code });
  });

  it("returns the refund and the new totals on success", async () => {
    const response = await post();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      refund: refundRow(),
      refundedCents: 2500,
      fullyRefunded: false,
      replay: false,
    });
  });

  it("passes the order, amount, key and user to the refund engine", async () => {
    await post();

    expect(state.inputs[0]?.input).toEqual({
      orderId: "order_1",
      appId: "app_1",
      amountCents: 2500,
      reason: "Damaged box",
      idempotencyKey: "refund-key-1",
      userId: "user_1",
      userEmail: "owner@example.com",
    });
  });

  it("builds the refund deps from the admin client", async () => {
    await post();

    const deps = state.inputs[0]?.deps as Record<string, unknown>;
    expect(typeof deps.store).toBe("object");
    expect(typeof deps.stripeAccountId).toBe("function");
    expect(typeof deps.resolvePaymentIntent).toBe("function");
    expect(typeof deps.createStripeRefund).toBe("function");
  });

  it("trims the reason", async () => {
    await post({ ...validBody, reason: "  Damaged box  " });

    expect(state.inputs[0]?.input.reason).toBe("Damaged box");
  });

  it("sends a blank reason as null", async () => {
    await post({ ...validBody, reason: "   " });

    expect(state.inputs[0]?.input.reason).toBeNull();
  });

  it("does not leak a thrown error", async () => {
    state.throwMessage = "secret Stripe detail: pi_123";

    const response = await post();

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toEqual({
      error: "Something went wrong sending the refund. Check Stripe before trying again.",
    });
    expect(JSON.stringify(payload)).not.toContain("pi_123");
  });
});
