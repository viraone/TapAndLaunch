import { describe, expect, it } from "vitest";
// The menu job lives outside src (it runs on the owner's Mac); its pure helpers are tested here.
import {
  appearsOnPage,
  chunkText,
  cleanPrice,
  findMenuLink,
  findPdfMenuLinks,
  joinTranscripts,
  mergePhotoReadings,
  mergeSections,
  normalizeForMatch,
  sameSite,
  pdfItemsToLines,
  sanitizeMenu,
  selectMenuImages,
  tileGrid,
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

describe("tileGrid", () => {
  it("skips a picture too small to bother with", () => {
    expect(tileGrid(450, 400)).toEqual([]);
  });
  it("splits a mid-size picture into quarters that overlap and cover it", () => {
    const tiles = tileGrid(1280, 905);
    expect(tiles.length).toBe(4);
    expect(Math.max(...tiles.map((t: { x: number; w: number }) => t.x + t.w))).toBe(1280);
    expect(Math.max(...tiles.map((t: { y: number; h: number }) => t.y + t.h))).toBe(905);
    expect(tiles[0].w).toBeGreaterThan(1280 / 2);
  });
  it("covers a big picture completely with overlapping tiles no larger than the limit", () => {
    const tiles = tileGrid(2500, 1768);
    expect(tiles.length).toBe(4);
    expect(tiles.every((t: { w: number; h: number }) => t.w <= 1300 && t.h <= 1300)).toBe(true);
    for (const [x, y] of [[0, 0], [1249, 883], [2499, 1767], [1300, 5], [20, 1700]]) {
      expect(tiles.some((t: { x: number; y: number; w: number; h: number }) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h)).toBe(true);
    }
    expect(Math.max(...tiles.map((t: { x: number; w: number }) => t.x + t.w))).toBe(2500);
  });
  it("never makes a tile that runs past the edge", () => {
    for (const t of tileGrid(3100, 2900)) {
      expect(t.x + t.w).toBeLessThanOrEqual(3100);
      expect(t.y + t.h).toBeLessThanOrEqual(2900);
    }
  });
});

describe("mergePhotoReadings", () => {
  const whole = () => [{ name: "Toppings", items: [{ name: "PLANT-BASED SWEET PORK", price: "$6.00", description: null }, { name: "CORN", price: "$1.50", description: null }, { name: "HOT TEA", price: null, description: null }] }];
  it("drops a price the two readings disagree on, keeps agreeing ones", () => {
    const tiled = [{ name: "Toppings", items: [{ name: "Plant-Based Sweet Pork", price: "$5.00", description: null }, { name: "Corn", price: "1.50", description: null }] }];
    const out = mergePhotoReadings(whole(), tiled);
    const items = out.sections[0].items;
    expect(items.find((i: { name: string }) => /plant/i.test(i.name)).price).toBeNull();
    expect(items.find((i: { name: string }) => /corn/i.test(i.name)).price).toBe("$1.50");
    expect(out.conflicts).toEqual(["PLANT-BASED SWEET PORK"]);
  });
  it("fills a price only the tiles saw", () => {
    const out = mergePhotoReadings(whole(), [{ name: "Toppings", items: [{ name: "Hot Tea", price: "$1.00", description: null }] }]);
    expect(out.sections[0].items.find((i: { name: string }) => /tea/i.test(i.name)).price).toBe("$1.00");
  });
  it("never adds dishes the first reading did not find (tiles cut names and misspell them)", () => {
    const tiled = [{ name: "Toppings", items: [{ name: "ABRASOBA Fragment", price: "$9", description: null }, { name: "CORN", price: "$1.50", description: null }] }];
    const out = mergePhotoReadings(whole(), tiled);
    expect(out.sections[0].items.map((i: { name: string }) => i.name)).toEqual(["PLANT-BASED SWEET PORK", "CORN", "HOT TEA"]);
  });
});

describe("sameSite", () => {
  it("trusts the restaurant's own site, its brand's other domain, and ordering platforms", () => {
    expect(sameSite("https://www.kajikenusa.com/", "https://kajikenusa.com/menu-1")).toBe(true);
    expect(sameSite("http://www.razzis.com/", "http://www.razzispizza.com/menus/traditional.html")).toBe(true);
    expect(sameSite("https://pizzeria.example.com/", "https://order.toasttab.com/online/pizzeria")).toBe(true);
    expect(sameSite("https://tengusushi.square.site/", "https://tengusushi.square.site/#P6YA")).toBe(true);
  });
  it("rejects listing sites about other restaurants", () => {
    expect(sameSite("https://phoba.website/", "https://pho-ba.menujoys.com/menu")).toBe(false);
    expect(sameSite("https://acafe-seattle.com/", "https://menu-prices.org/acafe")).toBe(false);
    expect(sameSite("", "https://x.example.com")).toBe(false);
  });
});

// ---- happy hour ----
import {
  buildHappyHourPrompt,
  findHappyHourLink,
  happyHourExcerpts,
  mentionsHappyHour,
  sanitizeHappyHour,
  timeAppearsIn,
} from "../../../tools/menu-ingest/lib.mjs";

describe("timeAppearsIn", () => {
  it("finds times written the usual ways", () => {
    expect(timeAppearsIn(16 * 60, "Happy hour Mon-Fri 4-6pm")).toBe(true);
    expect(timeAppearsIn(18 * 60, "Happy hour Mon-Fri 4-6pm")).toBe(true);
    expect(timeAppearsIn(16 * 60 + 30, "from 4:30 p.m. to 6:30 p.m.")).toBe(true);
    expect(timeAppearsIn(22 * 60, "Reverse happy hour 22:00 till close")).toBe(true);
  });
  it("does not take prices, discounts or the wrong am/pm for a time", () => {
    expect(timeAppearsIn(17 * 60, "$5 drafts 4-6pm")).toBe(false);
    expect(timeAppearsIn(16 * 60, "50% off 4pm")).toBe(true); // the 4pm is real
    expect(timeAppearsIn(10 * 60, "Mon-Fri 10% off")).toBe(false);
    expect(timeAppearsIn(4 * 60, "Mon-Fri 4pm-6pm")).toBe(false); // 4 AM is not 4pm
    expect(timeAppearsIn(16 * 60, "Mon-Fri 5-7pm")).toBe(false);
  });
});

describe("sanitizeHappyHour", () => {
  const page = "Welcome to the Bait Shop.\nHappy Hour Monday through Friday 4-6pm. $5 drafts and $7 wells.\nKitchen open until 10.";
  const good = { days: [1, 2, 3, 4, 5], start: "16:00", end: "18:00", deal: "$5 drafts and $7 wells", evidence: "Happy Hour Monday through Friday 4-6pm." };

  it("keeps a window the page backs up", () => {
    expect(sanitizeHappyHour([good], page)).toEqual({ windows: [{ days: [1, 2, 3, 4, 5], start: "16:00", end: "18:00", deal: "$5 drafts and $7 wells" }] });
  });
  it("drops a window whose evidence isn't on the page, or whose times aren't in the evidence", () => {
    expect(sanitizeHappyHour([{ ...good, evidence: "Happy hour every weekday 4-6pm" }], page).windows).toEqual([]);
    expect(sanitizeHappyHour([{ ...good, start: "15:00" }], page).windows).toEqual([]);
    expect(sanitizeHappyHour([{ ...good, end: "20:00" }], page).windows).toEqual([]);
  });
  it("keeps the window but drops deal wording that isn't on the page", () => {
    const r = sanitizeHappyHour([{ ...good, deal: "Half-price oysters" }], page);
    expect(r.windows[0].deal).toBeNull();
  });
  it("accepts 'until close' and requires day words unless it's every day", () => {
    const p = "Happy hour Fri & Sat from 9pm till close.";
    const w = { days: [5, 6], start: "21:00", end: null, deal: null, evidence: "Happy hour Fri & Sat from 9pm till close." };
    expect(sanitizeHappyHour([w], p).windows).toEqual([{ days: [5, 6], start: "21:00", end: null, deal: null }]);
    const p2 = "Happy hour 4-6pm.";
    const noDays = { days: [1, 2], start: "16:00", end: "18:00", deal: null, evidence: "Happy hour 4-6pm." };
    expect(sanitizeHappyHour([noDays], p2).windows).toEqual([]);
    expect(sanitizeHappyHour([{ ...noDays, days: [0, 1, 2, 3, 4, 5, 6] }], p2).windows).toHaveLength(1);
  });
  it("drops malformed, too-long and duplicate windows", () => {
    expect(sanitizeHappyHour([{ ...good, days: [] }, { ...good, start: "4pm" }, { ...good, end: "16:00" }], page).windows).toEqual([]);
    const allDay = "Happy hour daily 7am-11pm";
    expect(sanitizeHappyHour([{ days: [0, 1, 2, 3, 4, 5, 6], start: "07:00", end: "23:00", deal: null, evidence: "Happy hour daily 7am-11pm" }], allDay).windows).toEqual([]);
    expect(sanitizeHappyHour([good, { ...good }], page).windows).toHaveLength(1);
    expect(sanitizeHappyHour(null, page)).toEqual({ windows: [] });
  });
});

describe("happy hour page reading", () => {
  it("spots mentions and cuts excerpts around them", () => {
    expect(mentionsHappyHour("Join us for Happy-Hour!")).toBe(true);
    expect(mentionsHappyHour("Great hours, happy customers")).toBe(false);
    const text = `${"x ".repeat(2000)}HAPPY HOUR Mon-Fri 4-6pm${" y".repeat(2000)}`;
    const ex = happyHourExcerpts(text);
    expect(ex).toContain("HAPPY HOUR Mon-Fri 4-6pm");
    expect(ex.length).toBeLessThan(2000);
  });
  it("finds a happy hour link", () => {
    const html = '<a href="/about">About</a><a href="/specials">Specials</a><a href="/happy-hour">Happy Hour</a>';
    expect(findHappyHourLink(html, "https://bar.example/")).toBe("https://bar.example/happy-hour");
    expect(findHappyHourLink('<a href="/menu">Menu</a>', "https://bar.example/")).toBeNull();
  });
  it("puts the restaurant and text in the prompt", () => {
    const p = buildHappyHourPrompt("Bait Shop", "Happy hour 4-6pm");
    expect(p).toContain("Bait Shop");
    expect(p).toContain("Happy hour 4-6pm");
  });
});
