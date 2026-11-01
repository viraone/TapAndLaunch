import { describe, expect, it } from "vitest";
import {
  ORDERS_PAGE_SIZE,
  ORDER_STATUS_FILTERS,
  escapeIlike,
  orderSearchFilter,
  pageRange,
  parseOrderListParams,
} from "./query";

describe("order list constants", () => {
  it("offers the statuses the orders page filters on", () => {
    expect(ORDER_STATUS_FILTERS).toEqual([
      "all",
      "pending",
      "paid",
      "fulfilled",
      "cancelled",
      "refunded",
    ]);
  });

  it("shows 25 orders per page", () => {
    expect(ORDERS_PAGE_SIZE).toBe(25);
  });
});

describe("parseOrderListParams", () => {
  it("falls back to an empty search, all statuses, no tag and page 1", () => {
    expect(parseOrderListParams({})).toEqual({ q: "", status: "all", tag: "", page: 1 });
  });

  it("trims the search and caps it at 80 characters", () => {
    expect(parseOrderListParams({ q: "  Ada Lovelace  " })).toEqual({
      q: "Ada Lovelace",
      status: "all",
      tag: "",
      page: 1,
    });
    expect(parseOrderListParams({ q: "x".repeat(81) }).q).toBe("x".repeat(80));
  });

  it("takes the first value of every repeated parameter", () => {
    expect(
      parseOrderListParams({ q: ["first", "second"], status: ["paid", "pending"], page: ["3", "4"] })
    ).toEqual({ q: "first", status: "paid", tag: "", page: 3 });
  });

  it("keeps a whitelisted status and rejects anything else", () => {
    expect(parseOrderListParams({ status: "pending" }).status).toBe("pending");
    expect(parseOrderListParams({ status: "refunded" }).status).toBe("refunded");
    expect(parseOrderListParams({ status: "shipped" }).status).toBe("all");
    expect(parseOrderListParams({ status: "PAID" }).status).toBe("all");
    expect(parseOrderListParams({ status: "" }).status).toBe("all");
  });

  it("normalizes the tag filter and falls back to no tag", () => {
    expect(parseOrderListParams({ tag: "  VIP  " }).tag).toBe("vip");
    expect(parseOrderListParams({ tag: "a, b" }).tag).toBe("a b");
    expect(parseOrderListParams({ tag: ["First", "second"] }).tag).toBe("first");
    expect(parseOrderListParams({ tag: "" }).tag).toBe("");
    expect(parseOrderListParams({ tag: "x".repeat(25) }).tag).toBe("");
  });

  it("accepts only whole pages at or above 1", () => {
    expect(parseOrderListParams({ page: "2" }).page).toBe(2);
    expect(parseOrderListParams({ page: "1" }).page).toBe(1);
    expect(parseOrderListParams({ page: "abc" }).page).toBe(1);
    expect(parseOrderListParams({ page: "0" }).page).toBe(1);
    expect(parseOrderListParams({ page: "-3" }).page).toBe(1);
    expect(parseOrderListParams({ page: "1.5" }).page).toBe(1);
    expect(parseOrderListParams({ page: "" }).page).toBe(1);
  });

  it("caps the page at 10000", () => {
    expect(parseOrderListParams({ page: "9999" }).page).toBe(9999);
    expect(parseOrderListParams({ page: "10000" }).page).toBe(10000);
    expect(parseOrderListParams({ page: "10001" }).page).toBe(10000);
  });
});

describe("escapeIlike", () => {
  it("leaves ordinary text alone", () => {
    expect(escapeIlike("Ada Lovelace")).toBe("Ada Lovelace");
  });

  it("escapes wildcard and escape characters", () => {
    expect(escapeIlike("50%")).toBe("50\\%");
    expect(escapeIlike("under_score")).toBe("under\\_score");
    expect(escapeIlike("back\\slash")).toBe("back\\\\slash");
  });

  it("removes PostgREST .or() syntax characters", () => {
    expect(escapeIlike('a,b(c)"d')).toBe("abcd");
  });

  it("handles a search full of syntax characters", () => {
    expect(escapeIlike('50%_off,(x)"y\\z')).toBe("50\\%\\_offxy\\\\z");
  });
});

describe("orderSearchFilter", () => {
  it("returns null for an empty or whitespace-only search", () => {
    expect(orderSearchFilter("", ["customer_name"])).toBeNull();
    expect(orderSearchFilter("   ", ["customer_name"])).toBeNull();
  });

  it("searches every column with ILIKE", () => {
    expect(orderSearchFilter("ada", ["customer_name", "customer_email"])).toBe(
      "customer_name.ilike.%ada%,customer_email.ilike.%ada%"
    );
  });

  it("trims the term before building the pattern", () => {
    expect(orderSearchFilter("  ada  ", ["customer_name"])).toBe(
      "customer_name.ilike.%ada%"
    );
  });

  it("cannot inject extra .or() filters", () => {
    expect(orderSearchFilter('(a),"b"', ["customer_name", "customer_email"])).toBe(
      "customer_name.ilike.%ab%,customer_email.ilike.%ab%"
    );
  });

  it("escapes like wildcards inside the pattern", () => {
    expect(orderSearchFilter('50%_off,(x)"y\\z', ["customer_name"])).toBe(
      "customer_name.ilike.%50\\%\\_offxy\\\\z%"
    );
  });
});

describe("pageRange", () => {
  it("uses 25 rows per page by default", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 24 });
    expect(pageRange(3)).toEqual({ from: 50, to: 74 });
  });

  it("honours a custom page size", () => {
    expect(pageRange(2, 10)).toEqual({ from: 10, to: 19 });
  });
});
