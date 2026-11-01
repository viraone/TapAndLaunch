import { describe, expect, it } from "vitest";
import {
  REFUND_CURRENCIES,
  dollarsToCents,
  partlyRefunded,
  refundableCents,
  validateRefundAmount,
} from "./refunds";

const order = (over: Partial<{ total_cents: number; refunded_cents: number; status: string }> = {}) => ({
  total_cents: 10000,
  refunded_cents: 0,
  status: "paid",
  ...over,
});

describe("REFUND_CURRENCIES", () => {
  it("lists the two-decimal currencies we can refund in", () => {
    expect(REFUND_CURRENCIES).toEqual(["usd", "cad", "eur", "gbp", "aud", "nzd", "chf", "sek", "nok", "dkk"]);
  });

  it("leaves out zero-decimal currencies", () => {
    expect(REFUND_CURRENCIES).not.toContain("jpy");
    expect(REFUND_CURRENCIES).not.toContain("krw");
  });
});

describe("refundableCents", () => {
  it("returns the whole total for a paid order with no refunds", () => {
    expect(refundableCents(order())).toBe(10000);
  });

  it("counts a fulfilled order as refundable", () => {
    expect(refundableCents(order({ status: "fulfilled" }))).toBe(10000);
  });

  it("returns what is left after an earlier partial refund", () => {
    expect(refundableCents(order({ refunded_cents: 2500 }))).toBe(7500);
  });

  it("returns zero for pending, cancelled and refunded orders", () => {
    expect(refundableCents(order({ status: "pending" }))).toBe(0);
    expect(refundableCents(order({ status: "cancelled" }))).toBe(0);
    expect(refundableCents(order({ status: "refunded" }))).toBe(0);
  });

  it("never goes below zero when the ledger says more went back than the total", () => {
    expect(refundableCents(order({ refunded_cents: 12000 }))).toBe(0);
  });
});

describe("dollarsToCents", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.50", 1250],
    ["$12.50", 1250],
    [" 1,200.50 ", 120050],
    ["1,200", 120000],
    [".5", 50],
    ["0.01", 1],
    ["00012", 1200],
    ["999999.99", 99999999],
  ])("turns %s into %i cents", (text, cents) => {
    expect(dollarsToCents(text)).toBe(cents);
  });

  it.each([
    "",
    "   ",
    "0",
    "0.00",
    "-1",
    "-0.50",
    "1.234",
    "abc",
    "1e3",
    "12.",
    ".",
    "$",
    "1,2",
    "12,34",
    "1 200",
    "+5",
    "1.2.3",
    "1000000",
  ])("rejects %j", (text) => {
    expect(dollarsToCents(text)).toBeNull();
  });

  it("caps the amount at 99,999,999 cents", () => {
    expect(dollarsToCents("999999.99")).toBe(99999999);
    expect(dollarsToCents("1000000")).toBeNull();
  });
});

describe("validateRefundAmount", () => {
  it("accepts a whole number of cents up to what is left", () => {
    expect(validateRefundAmount(2500, 10000)).toEqual({ ok: true, cents: 2500 });
    expect(validateRefundAmount(10000, 10000)).toEqual({ ok: true, cents: 10000 });
  });

  it.each([0, -100, 12.5, Number.NaN, Number.POSITIVE_INFINITY, "2500", null, undefined])(
    "rejects %j as an invalid amount",
    (amount) => {
      expect(validateRefundAmount(amount, 10000)).toEqual({
        ok: false,
        code: "invalid_amount",
        message: "Enter a refund amount greater than zero, like 12.50.",
      });
    }
  );

  it("refuses one cent more than is left, and says the maximum", () => {
    expect(validateRefundAmount(2501, 2500)).toEqual({
      ok: false,
      code: "exceeds",
      message: "You can refund at most $25.00 on this order.",
    });
  });
});

describe("partlyRefunded", () => {
  it("is true when some, but not all, money has gone back", () => {
    expect(partlyRefunded(order({ refunded_cents: 2500 }))).toBe(true);
    expect(partlyRefunded(order({ status: "fulfilled", refunded_cents: 9999 }))).toBe(true);
  });

  it("is false when nothing or everything has gone back", () => {
    expect(partlyRefunded(order())).toBe(false);
    expect(partlyRefunded(order({ refunded_cents: 10000 }))).toBe(false);
    expect(partlyRefunded(order({ refunded_cents: 12000 }))).toBe(false);
  });

  it("is false for an order that is not paid or fulfilled", () => {
    expect(partlyRefunded(order({ status: "pending", refunded_cents: 2500 }))).toBe(false);
    expect(partlyRefunded(order({ status: "cancelled", refunded_cents: 2500 }))).toBe(false);
    expect(partlyRefunded(order({ status: "refunded", refunded_cents: 2500 }))).toBe(false);
  });
});
