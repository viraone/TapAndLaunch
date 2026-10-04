import { describe, expect, it } from "vitest";
// The menu job lives outside src (it runs on the owner's Mac); its pure helpers are tested here.
import {
  appearsOnPage,
  chunkText,
  cleanPrice,
  findMenuLink,
  findPdfMenuLinks,
  joinTranscripts,
  mergeSections,
  normalizeForMatch,
  pdfItemsToLines,
  sanitizeMenu,
  selectMenuImages,
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

describe("PDF menus", () => {
  it("finds PDF links that look like a menu, best first, and skips wine lists, catering and other files", () => {
    const html = `<a href="/files/catering.pdf">Catering</a><a href="/a/lunch-specials.pdf">Lunch</a><a href="/menu/kona_menu_v7.pdf">Menu</a><a href="/wine.pdf">Wine list</a><a href="/photo.jpg">Menu</a><a href="/x.pdf" title="Dinner Menu">Download</a>`;
    expect(findPdfMenuLinks(html, "https://kona.example.com/")).toEqual([
      "https://kona.example.com/menu/kona_menu_v7.pdf",
      "https://kona.example.com/x.pdf",
      "https://kona.example.com/a/lunch-specials.pdf",
    ]);
    expect(findPdfMenuLinks(`<a href="/contact">Contact</a>`, "https://a.example.com/")).toEqual([]);
  });
  it("keeps a dish and its price on one line, top to bottom", () => {
    const lines = pdfItemsToLines([
      { str: "$14.95", x: 400, y: 700 },
      { str: "Pad Thai", x: 50, y: 701 },
      { str: "Soups", x: 50, y: 720 },
      { str: "Tom Yum", x: 50, y: 680 },
      { str: "$9", x: 400, y: 681 },
      { str: "  ", x: 10, y: 10 },
    ]);
    expect(lines).toEqual(["Soups", "Pad Thai $14.95", "Tom Yum $9"]);
  });
});

describe("photo menus", () => {
  it("keeps big pictures that could be a menu, largest first, without logos or repeats", () => {
    const picked = selectMenuImages([
      { src: "https://x.example.com/a/menu-page-1.jpg?format=1500w", width: 1500, height: 2000 },
      { src: "https://x.example.com/a/menu-page-1.jpg?format=750w", width: 750, height: 1000 },
      { src: "https://x.example.com/a/Kajiken_TradeMark.png", width: 3000, height: 3000 },
      { src: "https://x.example.com/a/small.jpg", width: 300, height: 300 },
      { src: "data:image/png;base64,AAAA", width: 2000, height: 2000 },
      { src: "https://x.example.com/a/menu-page-2.jpg", width: 1600, height: 2200 },
    ]);
    expect(picked.map((p: { src: string }) => p.src)).toEqual(["https://x.example.com/a/menu-page-2.jpg", "https://x.example.com/a/menu-page-1.jpg?format=1500w"]);
  });
  it("caps how many pictures are read", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ src: `https://x.example.com/m${i}.jpg`, width: 1000 + i, height: 1000 }));
    expect(selectMenuImages(many)).toHaveLength(6);
  });
  it("joins the copied text and drops pictures with none", () => {
    expect(joinTranscripts(["Ramen 12\nGyoza 6", "NO TEXT", "  ", "no text.", "Beer 5"])).toBe("Ramen 12\nGyoza 6\n\nBeer 5");
    expect(joinTranscripts([])).toBe("");
  });
});
