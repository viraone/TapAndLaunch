import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats cents as an amount in the currency", () => {
    const formatted = formatMoney(1234, "usd");
    expect(formatted).toContain("$");
    expect(formatted).toContain("12.34");
  });

  it("accepts a lowercase currency code", () => {
    expect(formatMoney(500, "cad")).toContain("5.00");
  });

  it("keeps a negative amount negative", () => {
    expect(formatMoney(-250, "usd")).toContain("-");
    expect(formatMoney(-250, "usd")).toContain("2.50");
  });
});
