import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const stripe = vi.hoisted(() => ({ configured: true, cancel: vi.fn() }));
vi.mock("@/lib/stripe/server", () => ({
  isStripeConfigured: () => stripe.configured,
  getStripe: () => ({ subscriptions: { cancel: stripe.cancel } }),
}));

import { applySubscription, makeOrganizationFree } from "./stripe";

/** Just enough of the Supabase client: records the order of Stripe calls and writes, and what an update filtered on. */
function fakeAdmin(row: { stripe_subscription_id: string | null } | null, log: string[]) {
  const writes: Array<{ kind: "upsert" | "update"; values: Record<string, unknown>; filters: string[] }> = [];
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      upsert: async (values: Record<string, unknown>) => {
        log.push("write");
        writes.push({ kind: "upsert", values, filters: [] });
        return { error: null };
      },
      update: (values: Record<string, unknown>) => {
        const write = { kind: "update" as const, values, filters: [] as string[] };
        writes.push(write);
        const q = {
          eq: (c: string, v: unknown) => (write.filters.push(`${c} = ${String(v)}`), q),
          neq: (c: string, v: unknown) => (write.filters.push(`${c} <> ${String(v)}`), q),
          then: (resolve: (r: { error: null }) => void) => resolve({ error: null }),
        };
        return q;
      },
    }),
  };
  return { admin: admin as never, writes };
}

beforeEach(() => {
  stripe.configured = true;
  stripe.cancel.mockReset();
});

describe("makeOrganizationFree", () => {
  it("cancels the subscription at once, without proration or a final invoice, then marks the row free and clears the plan", async () => {
    const log: string[] = [];
    stripe.cancel.mockImplementation(async () => (log.push("cancel"), {}));
    const { admin, writes } = fakeAdmin({ stripe_subscription_id: "sub_123" }, log);
    expect(await makeOrganizationFree(admin, "org_1")).toEqual({ ok: true, cancelledSubscription: true });
    expect(stripe.cancel).toHaveBeenCalledWith("sub_123", { prorate: false, invoice_now: false });
    expect(log).toEqual(["cancel", "write"]);
    expect(writes[0]?.values).toEqual({
      organization_id: "org_1",
      status: "complimentary",
      stripe_subscription_id: null,
      plan_interval: null,
      current_period_end: null,
      cancel_at_period_end: false,
    });
  });

  it("changes nothing when Stripe refuses, so the row never says free while a subscription is still billing", async () => {
    stripe.cancel.mockRejectedValue(new Error("Stripe is having a bad day"));
    const { admin, writes } = fakeAdmin({ stripe_subscription_id: "sub_123" }, []);
    expect(await makeOrganizationFree(admin, "org_1")).toEqual({ ok: false, error: "Stripe is having a bad day" });
    expect(writes).toHaveLength(0);
  });

  it("treats a subscription Stripe no longer knows as already cancelled", async () => {
    stripe.cancel.mockRejectedValue(Object.assign(new Error("No such subscription"), { code: "resource_missing" }));
    const { admin, writes } = fakeAdmin({ stripe_subscription_id: "sub_gone" }, []);
    expect(await makeOrganizationFree(admin, "org_1")).toEqual({ ok: true, cancelledSubscription: false });
    expect(writes[0]?.values).toMatchObject({ status: "complimentary", stripe_subscription_id: null });
  });

  it("needs no Stripe call for an organization with no subscription", async () => {
    const { admin, writes } = fakeAdmin({ stripe_subscription_id: null }, []);
    expect(await makeOrganizationFree(admin, "org_1")).toEqual({ ok: true, cancelledSubscription: false });
    expect(stripe.cancel).not.toHaveBeenCalled();
    expect(writes[0]?.values).toMatchObject({ status: "complimentary" });
  });

  it("works for an organization that has no billing row at all", async () => {
    const { admin, writes } = fakeAdmin(null, []);
    expect(await makeOrganizationFree(admin, "org_1")).toEqual({ ok: true, cancelledSubscription: false });
    expect(writes[0]?.values).toMatchObject({ organization_id: "org_1", status: "complimentary" });
  });

  it("says so, and changes nothing, when a subscription exists but Stripe isn't configured on this server", async () => {
    stripe.configured = false;
    const { admin, writes } = fakeAdmin({ stripe_subscription_id: "sub_123" }, []);
    const result = await makeOrganizationFree(admin, "org_1");
    expect(result).toMatchObject({ ok: false });
    expect(stripe.cancel).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });
});

describe("applySubscription", () => {
  const sub = {
    id: "sub_123",
    status: "canceled",
    customer: "cus_1",
    cancel_at: null,
    cancel_at_period_end: false,
    items: { data: [{ current_period_end: 1790000000, price: { recurring: { interval: "year" } } }] },
  };

  it("leaves a free (complimentary) account alone: the update itself is conditional on it not being free", async () => {
    const { admin, writes } = fakeAdmin(null, []);
    await applySubscription(admin, "org_1", sub as never);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.filters).toEqual(["organization_id = org_1", "status <> complimentary"]);
    expect(writes[0]?.values).toMatchObject({ status: "canceled", stripe_subscription_id: "sub_123" });
  });
});
