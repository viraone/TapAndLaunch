import { describe, expect, it } from "vitest";
import { setAt } from "@/lib/builder/set-at";

describe("setAt", () => {
  it("replaces a top-level field without touching the rest", () => {
    const config = { heading: "Old", body: "Body" };
    const next = setAt(config, ["heading"], "New");
    expect(next).toEqual({ heading: "New", body: "Body" });
    expect(config.heading).toBe("Old");
  });

  it("replaces a field deep inside arrays, copying only the path", () => {
    const config = { title: "Menu", sections: [{ name: "Mains", items: [{ name: "Soup", price: "$5" }, { name: "Pie", price: "$9" }] }] };
    const next = setAt(config, ["sections", 0, "items", 1, "price"], "$12");
    expect(next.sections[0].items[1]).toEqual({ name: "Pie", price: "$12" });
    expect(next.sections[0].items[0]).toBe(config.sections[0].items[0]);
    expect(config.sections[0].items[1].price).toBe("$9");
  });

  it("creates what is missing on the way", () => {
    expect(setAt({} as { items?: Array<{ value: string }> }, ["items", 0, "value"], "10")).toEqual({ items: [{ value: "10" }] });
  });
});
