import { describe, expect, it } from "vitest";
// The menu job lives outside src (it runs on the owner's Mac); its pure helpers are tested here.
import {
  appearsOnPage,
  chunkText,
  cleanPrice,
  findMenuLink,
  mergeSections,
  normalizeForMatch,
  sanitizeMenu,
} from "../../../tools/menu-ingest/lib.mjs";

describe("cleanPrice", () => {
  it("formats plausible prices", () => {
    expect(cleanPrice("$14.95")).toBe("$14.95");
    expect(cleanPrice("14.5")).toBe("$14.50");
    expect(cleanPrice("$ 28")).toBe("$28");
    expect(cleanPrice("$3.00 each")).toBe("$3.00");
    expect(cleanPrice("5.0")).toBe("$5.00");
    expect(cleanPrice("1,2")).toBe("$12");
  });
  it("refuses implausible or missing prices", () => {
    expect(cleanPrice(null)).toBeNull();
    expect(cleanPrice("market price")).toBeNull();
    expect(cleanPrice("$0")).toBeNull();
    expect(cleanPrice("$93.50")).toBe("$93.50");
    expect(cleanPrice("$450")).toBeNull();
  });
});

describe("appearsOnPage", () => {
  const page = normalizeForMatch("Pad Thai 14.95\nSweet & Sour Chicken 14.95\n12. Phở tái $13\nGreen curry with Thai basil");
  it("finds names that are on the page, ignoring case, accents, punctuation and menu numbers", () => {
    expect(appearsOnPage("Pad Thai", page)).toBe(true);
    expect(appearsOnPage("Sweet and Sour Chicken", page)).toBe(true);
    expect(appearsOnPage("12. Pho tai", page)).toBe(true);
    expect(appearsOnPage("PAD THAI", page)).toBe(true);
  });
  it("rejects names the model made up", () => {
    expect(appearsOnPage("Lobster Thermidor", page)).toBe(false);
    expect(appearsOnPage("Mango Sticky Rice", page)).toBe(false);
    expect(appearsOnPage("ab", page)).toBe(false);
  });
});

describe("sanitizeMenu", () => {
  const items = ["Pad Thai", "Green Curry", "Red Curry", "Tom Yum", "Papaya Salad", "Spring Rolls"];
  const page = items.map((n, i) => `${n} ${10 + i}.95`).join("\n");
  const good = { sections: [{ name: "Entrees", items: items.map((name, i) => ({ name, price: `${10 + i}.95`, description: "Tasty" })) }] };

  it("keeps a clean menu and cleans prices", () => {
    const out = sanitizeMenu(good.sections, page)!;
    expect(out.itemCount).toBe(6);
    expect(out.sections[0].items[0]).toEqual({ name: "Pad Thai", price: "$10.95", description: "Tasty" });
  });
  it("drops invented items but keeps the rest", () => {
    const withFake = { sections: [{ name: "Entrees", items: [...good.sections[0].items, { name: "Lobster Thermidor", price: "$99" }] }] };
    const out = sanitizeMenu(withFake.sections, page)!;
    expect(out.itemCount).toBe(6);
    expect(JSON.stringify(out)).not.toContain("Lobster");
  });
  it("rejects a menu where too much was invented", () => {
    const fake = { sections: [{ name: "X", items: ["Alpha Dish", "Beta Dish", "Gamma Dish", "Delta Dish"].map((name) => ({ name, price: "$5" })).concat(good.sections[0].items.slice(0, 5)) }] };
    expect(sanitizeMenu(fake.sections, page)).toBeNull();
  });
  it("rejects a menu that is too small", () => {
    expect(sanitizeMenu([{ name: "A", items: [{ name: "Pad Thai", price: "$10" }] }], page)).toBeNull();
  });
  it("trims long descriptions and nulls a bad price", () => {
    const long = { sections: [{ name: "E", items: items.map((name) => ({ name, price: "ask", description: "x".repeat(300) })) }] };
    const out = sanitizeMenu(long.sections, page)!;
    expect(out.sections[0].items[0].price).toBeNull();
    expect(out.sections[0].items[0].description!.length).toBeLessThanOrEqual(140);
  });
});

describe("chunkText / mergeSections", () => {
  it("splits on line boundaries and never loses text", () => {
    const text = Array.from({ length: 50 }, (_, i) => `line ${i} ${"x".repeat(40)}`).join("\n");
    const chunks = chunkText(text, 500);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.length <= 500)).toBe(true);
    expect(chunks.join("\n")).toBe(text);
  });
  it("cuts a single enormous line instead of dropping it", () => {
    const chunks = chunkText("a".repeat(2500), 1000);
    expect(chunks.map((c) => c.length)).toEqual([1000, 1000, 500]);
  });
  it("merges same-named sections across chunks and drops repeats", () => {
    const merged = mergeSections([
      [{ name: "Entrees", items: [{ name: "Pad Thai", price: "$1" }] }],
      [{ name: "ENTREES", items: [{ name: "pad thai", price: "$1" }, { name: "Green Curry", price: "$2" }] }, { name: "Drinks", items: [{ name: "Tea", price: "$3" }] }],
    ]);
    expect(merged.map((s: { name: string }) => s.name)).toEqual(["Entrees", "Drinks"]);
    expect(merged[0].items.map((i: { name: string }) => i.name)).toEqual(["Pad Thai", "Green Curry"]);
  });
});

describe("findMenuLink (job copy)", () => {
  it("picks the menu page and ignores toggles, anchors and files", () => {
    const html = `<a class="menu-toggle" href="/x">Menu</a><a href="#">Menu</a><a href="/menu.pdf">Menu</a><a href="/eat">View Menu</a>`;
    expect(findMenuLink(html, "https://a.example.com/")).toBe("https://a.example.com/eat");
    expect(findMenuLink(`<a href="/contact">Contact</a>`, "https://a.example.com/")).toBeNull();
  });
});
