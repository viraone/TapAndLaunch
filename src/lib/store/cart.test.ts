import { describe, expect, it } from "vitest";
import { cartHasSubscription, cartSubtotalCents, cleanCountries, cleanShippingRates, formatPrice, mergeCartRequests, subscriptionShippingLine } from "./cart";

describe("mergeCartRequests", () => {
  it("adds up repeats and drops empty lines", () => {
    expect(mergeCartRequests([{ productId: "a", quantity: 1 }, { productId: "b", quantity: 0 }, { productId: "a", quantity: 2 }])).toEqual([{ productId: "a", quantity: 3 }]);
  });
  it("caps a line at 999 and ignores bad quantities", () => {
    expect(mergeCartRequests([{ productId: "a", quantity: 900 }, { productId: "a", quantity: 900 }])).toEqual([{ productId: "a", quantity: 999 }]);
    expect(mergeCartRequests([{ productId: "a", quantity: 1.5 }, { productId: "b", quantity: -1 }])).toEqual([]);
  });
});

describe("cart totals", () => {
  it("sums the lines and spots a subscription", () => {
    const lines = [{ unitPriceCents: 2500, quantity: 2, interval: null }, { unitPriceCents: 1000, quantity: 1, interval: "month" as const }];
    expect(cartSubtotalCents(lines)).toBe(6000);
    expect(cartHasSubscription(lines)).toBe(true);
    expect(cartHasSubscription([lines[0]])).toBe(false);
  });
});

describe("formatPrice", () => {
  it("adds the interval for a recurring price", () => {
    expect(formatPrice(1000, "usd", "month")).toMatch(/10\.00\/month$/);
    expect(formatPrice(1000, "usd")).not.toContain("/");
  });
});

describe("cleanShippingRates", () => {
  it("keeps well-formed rates, at most five", () => {
    const rates = cleanShippingRates([
      { name: " Standard ", amount_cents: 500, min_days: 3, max_days: 5 },
      { name: "Pickup", amount_cents: 0, max_days: 2 },
      { name: "", amount_cents: 100 },
      { name: "Bad price", amount_cents: -1 },
      { name: "Bad days", amount_cents: 100, min_days: 5, max_days: 2 },
      "junk",
      { name: "F", amount_cents: 1 },
      { name: "G", amount_cents: 1 },
      { name: "H", amount_cents: 1 },
    ]);
    expect(rates).toEqual([
      { name: "Standard", amount_cents: 500, min_days: 3, max_days: 5 },
      { name: "Pickup", amount_cents: 0, max_days: 2 },
      { name: "Bad days", amount_cents: 100, min_days: 5 },
      { name: "F", amount_cents: 1 },
      { name: "G", amount_cents: 1 },
    ]);
    expect(cleanShippingRates("nope")).toEqual([]);
  });
});

describe("cleanCountries", () => {
  it("upper-cases two-letter codes and drops the rest", () => {
    expect(cleanCountries(["us", " ca ", "USA", "", 3, "us"])).toEqual(["US", "CA"]);
  });
});

describe("subscriptionShippingLine", () => {
  it("turns the first paid rate into a one-time line, and nothing when shipping is free or unset", () => {
    expect(subscriptionShippingLine([{ name: "Standard", amount_cents: 500 }, { name: "Express", amount_cents: 1500 }])).toEqual({
      productId: null, name: "Shipping: Standard", unitPriceCents: 500, quantity: 1, interval: null,
    });
    expect(subscriptionShippingLine([{ name: "Pickup", amount_cents: 0 }])).toBeNull();
    expect(subscriptionShippingLine([])).toBeNull();
  });
});
