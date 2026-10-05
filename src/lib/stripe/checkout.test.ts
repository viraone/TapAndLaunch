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
  const base = {
    orderId: "o1",
    appId: "a1",
    productId: "p1",
    productName: "Tee",
    unitPriceCents: 2500,
    currency: "USD",
    quantity: 2,
    customerEmail: "fan@example.com",
    origin: "https://gym.tapandlaunch.com",
    returnPath: "/shop",
    feeCents: 0,
  };

  it("lets Stripe ask for the email when the buy form didn't", () => {
    const p = buildCheckoutSessionParams({ ...base, customerEmail: undefined });
    expect(p).not.toHaveProperty("customer_email");
    expect(p.payment_intent_data).not.toHaveProperty("receipt_email");
  });

  it("builds a one-line hosted checkout that returns to the page", () => {
    const p = buildCheckoutSessionParams(base);
    expect(p.mode).toBe("payment");
    expect(p.line_items).toEqual([
      { quantity: 2, price_data: { currency: "usd", unit_amount: 2500, product_data: { name: "Tee" } } },
    ]);
    expect(p.customer_email).toBe("fan@example.com");
    expect(p.client_reference_id).toBe("o1");
    expect(p.metadata).toEqual({ order_id: "o1", app_id: "a1" });
    expect(p.success_url).toBe("https://gym.tapandlaunch.com/shop?payment=success&order=o1&product=p1");
    expect(p.cancel_url).toBe("https://gym.tapandlaunch.com/shop?payment=cancelled");
    expect(p.payment_intent_data).toEqual({ receipt_email: "fan@example.com" });
  });

  it("adds the platform fee only when there is one, and always asks Stripe to email the receipt", () => {
    expect(buildCheckoutSessionParams({ ...base, feeCents: 150 }).payment_intent_data).toEqual({
      receipt_email: "fan@example.com",
      application_fee_amount: 150,
    });
  });
});
