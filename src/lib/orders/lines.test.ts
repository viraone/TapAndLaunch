import { describe, expect, it } from "vitest";
import { isShippingRow, splitOrderLines } from "./lines";

const candle = { product_id: "p1", product_name: "Cedar & Smoke candle", unit_price_cents: 2800, quantity: 2 };
const club = { product_id: "p2", product_name: "Candle club", unit_price_cents: 1000, quantity: 1 };
const shipping = { product_id: null, product_name: "Shipping: Standard shipping", unit_price_cents: 500, quantity: 1 };

describe("isShippingRow", () => {
  it("is true for a null product with a Shipping: name", () => {
    expect(isShippingRow(shipping)).toBe(true);
  });

  it("is false for a real product, even one whose name starts with Shipping:", () => {
    expect(isShippingRow(candle)).toBe(false);
    expect(isShippingRow({ product_id: "p9", product_name: "Shipping: gift wrap" })).toBe(false);
  });

  it("is false for a deleted product (null id) that is not a shipping row", () => {
    expect(isShippingRow({ product_id: null, product_name: "Old candle" })).toBe(false);
  });
});

describe("splitOrderLines", () => {
  it("separates shipping rows and totals each side", () => {
    const split = splitOrderLines([candle, club, shipping]);
    expect(split.products).toEqual([candle, club]);
    expect(split.shippingRows).toEqual([shipping]);
    expect(split.productsCents).toBe(6600);
    expect(split.shippingRowsCents).toBe(500);
  });

  it("handles no lines and no shipping row", () => {
    expect(splitOrderLines([])).toEqual({ products: [], shippingRows: [], productsCents: 0, shippingRowsCents: 0 });
    expect(splitOrderLines([candle]).shippingRowsCents).toBe(0);
  });
});
