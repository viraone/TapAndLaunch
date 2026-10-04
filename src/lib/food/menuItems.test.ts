import { describe, expect, it } from "vitest";
import { filterMenu, parseMenu, type MenuSection } from "@/lib/food/menuItems";

describe("parseMenu", () => {
  it("reads a well-formed saved menu", () => {
    const out = parseMenu({ sections: [{ name: "Entrees", items: [{ name: "Pad Thai", price: "$14.95", description: "Rice noodles" }] }] });
    expect(out).toEqual([{ name: "Entrees", items: [{ name: "Pad Thai", price: "$14.95", description: "Rice noodles" }] }]);
  });
  it("drops malformed items and empty sections, and returns null when nothing is left", () => {
    expect(parseMenu({ sections: [{ name: "A", items: [{ price: "$1" }, { name: "  " }, 5, null] }] })).toBeNull();
    expect(parseMenu({ sections: [{ name: "A", items: [{ name: "Ok" }, { price: "$1" }] }, { name: "B", items: [] }] })).toEqual([
      { name: "A", items: [{ name: "Ok", price: null, description: null }] },
    ]);
  });
  it("returns null for anything that isn't a menu", () => {
    for (const bad of [null, undefined, 5, "x", {}, { sections: "no" }, { sections: [] }]) expect(parseMenu(bad)).toBeNull();
  });
  it("trims lengths and whitespace", () => {
    const out = parseMenu({ sections: [{ name: " Soups ", items: [{ name: "  Tom   Yum ", price: "$9", description: "x".repeat(500) }] }] })!;
    expect(out[0].name).toBe("Soups");
    expect(out[0].items[0].name).toBe("Tom Yum");
    expect(out[0].items[0].description!.length).toBe(140);
  });
});

describe("filterMenu", () => {
  const menu: MenuSection[] = [
    { name: "Curries", items: [{ name: "Green Curry", price: "$14", description: "Thai basil, eggplant" }, { name: "Panang", price: "$15", description: null }] },
    { name: "Noodles", items: [{ name: "Pad Thai", price: "$13", description: "Rice noodles, peanuts" }] },
  ];
  it("returns everything for an empty search", () => {
    expect(filterMenu(menu, "  ")).toBe(menu);
  });
  it("matches names, descriptions and section names, ignoring case and accents", () => {
    expect(filterMenu(menu, "PAD").map((s) => s.name)).toEqual(["Noodles"]);
    expect(filterMenu(menu, "basil")[0].items.map((i) => i.name)).toEqual(["Green Curry"]);
    expect(filterMenu(menu, "curries").flatMap((s) => s.items).length).toBe(2);
  });
  it("needs every word to match, and can match nothing", () => {
    expect(filterMenu(menu, "thai basil")[0].items.length).toBe(1);
    expect(filterMenu(menu, "thai peanuts")[0].items[0].name).toBe("Pad Thai"); // both words are in that one dish
    expect(filterMenu(menu, "basil peanuts").length).toBe(0); // in different dishes
    expect(filterMenu(menu, "zzz")).toEqual([]);
  });
});
