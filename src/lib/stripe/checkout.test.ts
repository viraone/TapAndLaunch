import { describe, expect, it } from "vitest";
import { appOrigin, applicationFeeCents, buildCheckoutSessionParams, canPayByCard, safeReturnPath } from "./checkout";

describe("canPayByCard", () => {
  it("needs at least 50 cents", () => {
    expect(canPayByCard(49)).toBe(false);
    expect(canPayByCard(50)).toBe(true);
    expect(canPayByCard(0)).toBe(false);
  });
});

describe("applicationFeeCents", () => {
  it("is zero unless a sensible percentage is set", () => {
    expect(applicationFeeCents(10000, undefined)).toBe(0);
    expect(applicationFeeCents(10000, "")).toBe(0);
    expect(applicationFeeCents(10000, "abc")).toBe(0);
    expect(applicationFeeCents(10000, "-5")).toBe(0);
    expect(applicationFeeCents(10000, "90")).toBe(0);
  });
  it("rounds to whole cents", () => {
    expect(applicationFeeCents(10000, "2")).toBe(200);
    expect(applicationFeeCents(999, "2.5")).toBe(25);
  });
});

describe("safeReturnPath", () => {
  it("keeps same-site paths", () => {
    expect(safeReturnPath("/shop")).toBe("/shop");
    expect(safeReturnPath("/")).toBe("/");
  });
  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "shop", "", undefined, 42, "/" + "a".repeat(300)]) {
      expect(safeReturnPath(bad)).toBe("/");
    }
  });
});

describe("appOrigin", () => {
  it("uses https on a real domain and http locally", () => {
    expect(appOrigin("gym", "tapandlaunch.com")).toBe("https://gym.tapandlaunch.com");
    expect(appOrigin("gym", "localhost:3100")).toBe("http://gym.localhost:3100");
    expect(appOrigin("gym", "apps.localhost:3100")).toBe("http://gym.apps.localhost:3100");
    expect(appOrigin("gym", "192.168.1.20:3100")).toBe("http://gym.192.168.1.20:3100");
    expect(appOrigin("gym", "tapandlaunch.app")).toBe("https://gym.tapandlaunch.app");
  });
});

describe("buildCheckoutSessionParams", () => {
  const tee = { productId: "p1", name: "Tee", unitPriceCents: 2500, quantity: 2, interval: null };
  const club = { productId: "p2", name: "Club", unitPriceCents: 1000, quantity: 1, interval: "month" as const };
  const base = {
    orderId: "o1",
    appId: "a1",
    currency: "USD",
    lines: [tee],
    customerEmail: "fan@example.com",
    origin: "https://gym.tapandlaunch.com",
    returnPath: "/shop",
    feePercentSetting: undefined,
    shipping: null,
    automaticTax: false,
    promoCodes: false,
  };

  it("lets Stripe ask for the email when the cart didn't", () => {
    const p = buildCheckoutSessionParams({ ...base, customerEmail: undefined });
    expect(p).not.toHaveProperty("customer_email");
    expect(p.payment_intent_data).not.toHaveProperty("receipt_email");
  });

  it("builds a hosted checkout for the cart that returns to the page", () => {
    const p = buildCheckoutSessionParams({ ...base, lines: [tee, { ...tee, productId: "p3", name: "Cap", unitPriceCents: 1500, quantity: 1 }] });
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([
      { quantity: 2, price_data: { currency: "usd", unit_amount: 2500, product_data: { name: "Tee" } } },
      { quantity: 1, price_data: { currency: "usd", unit_amount: 1500, product_data: { name: "Cap" } } },
    ]);
    expect(p.customer_email).toBe("fan@example.com");
    expect(p.client_reference_id).toBe("o1");
    expect(p.metadata).toEqual({ order_id: "o1", app_id: "a1" });
    expect(p.success_url).toBe("https://gym.tapandlaunch.com/shop?payment=success&order=o1");
    expect(p.cancel_url).toBe("https://gym.tapandlaunch.com/shop?payment=cancelled");
    expect(p.payment_intent_data).toEqual({ receipt_email: "fan@example.com" });
    expect(p).not.toHaveProperty("shipping_options");
    expect(p).not.toHaveProperty("automatic_tax");
    expect(p).not.toHaveProperty("allow_promotion_codes");
  });

  it("takes the platform fee as cents on a one-time order", () => {
    expect(buildCheckoutSessionParams({ ...base, feePercentSetting: "2" }).payment_intent_data).toEqual({
      receipt_email: "fan@example.com",
      application_fee_amount: 100,
    });
  });

  it("becomes a subscription when any line recurs, with the fee as a percent", () => {
    const p = buildCheckoutSessionParams({ ...base, lines: [tee, club], feePercentSetting: "2.5" });
    expect(p.mode).toBe("subscription");
    expect(p.line_items?.[1]).toEqual({ quantity: 1, price_data: { currency: "usd", unit_amount: 1000, product_data: { name: "Club" }, recurring: { interval: "month" } } });
    expect(p.subscription_data).toEqual({ metadata: { order_id: "o1", app_id: "a1" }, application_fee_percent: 2.5 });
    expect(p).not.toHaveProperty("payment_intent_data");
  });

  it("asks for an address and offers the rates when shipping is on", () => {
    const p = buildCheckoutSessionParams({
      ...base,
      shipping: { rates: [{ name: "Standard", amount_cents: 500, min_days: 3, max_days: 5 }, { name: "Pickup", amount_cents: 0 }], countries: ["US", "CA"] },
    });
    expect(p.shipping_address_collection).toEqual({ allowed_countries: ["US", "CA"] });
    expect(p.shipping_options).toEqual([
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Standard",
          fixed_amount: { amount: 500, currency: "usd" },
          delivery_estimate: { minimum: { unit: "business_day", value: 3 }, maximum: { unit: "business_day", value: 5 } },
        },
      },
      { shipping_rate_data: { type: "fixed_amount", display_name: "Pickup", fixed_amount: { amount: 0, currency: "usd" } } },
    ]);
  });

  it("asks only for the address on a subscription, since Stripe allows no rate choice there", () => {
    const p = buildCheckoutSessionParams({ ...base, lines: [tee, club], shipping: { rates: [{ name: "Standard", amount_cents: 500 }], countries: ["US"] } });
    expect(p.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
    expect(p).not.toHaveProperty("shipping_options");
  });

  it("skips shipping when it's on but no rate was kept", () => {
    expect(buildCheckoutSessionParams({ ...base, shipping: { rates: [], countries: ["US"] } })).not.toHaveProperty("shipping_options");
  });

  it("turns on Stripe Tax and promo codes when asked", () => {
    const p = buildCheckoutSessionParams({ ...base, automaticTax: true, promoCodes: true });
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.allow_promotion_codes).toBe(true);
  });
});
