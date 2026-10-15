import { describe, expect, it } from "vitest";
import { isReservedPagePath } from "@/lib/pwa/reserved-paths";
import { BLOCK_TYPES } from "@/lib/builder/block-defaults";
import { ABOUT_MAX_LENGTH, STARTER_TEMPLATES, TEMPLATE_CATEGORIES, WEBSITE_STYLES, WEBSITE_TOPICS, buildStarter, isTemplateId, parseWebsiteDesign, starterTemplateFor, templateNeedsMaps, websiteDesigns, websiteStyleOf } from "./templates";
import { LOOK_IDS } from "@/lib/pwa/look";

const TOPIC_IDS = ["photography", "design", "education", "consulting", "art", "health", "marketing", "technology", "construction", "apparel", "music", "realestate", "beauty", "travel", "weddings"];

describe("starter templates", () => {
  it("offers a template for everything, ending with a blank one", () => {
    expect(STARTER_TEMPLATES.map((t) => t.id)).toEqual(["portfolio", ...TOPIC_IDS, "business", "store", "events", "food", "gas", "openmic", "restaurant", "fitness", "salon", "community", "blank", "byob"]);
    expect(STARTER_TEMPLATES.at(-1)?.id).toBe("byob");
    expect(new Set(STARTER_TEMPLATES.map((t) => t.id)).size).toBe(STARTER_TEMPLATES.length);
    expect(isTemplateId("store")).toBe(true);
    expect(isTemplateId("nope")).toBe(false);
  });

  it("groups every template under a real category, and every category has a template", () => {
    const ids = TEMPLATE_CATEGORIES.map((c) => c.id);
    for (const t of STARTER_TEMPLATES) expect(ids).toContain(t.category);
    for (const c of TEMPLATE_CATEGORIES) expect(STARTER_TEMPLATES.some((t) => t.category === c.id)).toBe(true);
  });

  for (const template of STARTER_TEMPLATES) {
    it(`${template.id} builds a valid app`, () => {
      const starter = buildStarter(template.id, "Maple Street Bakery");
      const paths = starter.pages.map((p) => p.path);

      expect(starter.pages.filter((p) => p.isHome)).toHaveLength(1);
      expect(new Set(paths).size).toBe(paths.length);
      for (const path of paths) expect(isReservedPagePath(path)).toBe(false);
      for (const page of starter.pages) for (const b of page.blocks) expect(BLOCK_TYPES).toContain(b.type);
      for (const tab of starter.theme.bottom_nav ?? []) expect(paths).toContain(tab.page_path);
      expect(starter.manifest.name).toBe("Maple Street Bakery");
    });
  }

  it("opens every finished template with a photo banner that has a headline", () => {
    // The website templates are deliberately photo-less: their hero falls back to a solid brand colour
    // (HeroBlockView), so a personal site never starts with a stock photo of a stranger.
    for (const t of STARTER_TEMPLATES.filter((x) => x.category !== "website" && !["food", "gas", "blank", "byob"].includes(x.id))) {
      const first = buildStarter(t.id, "Maple Street Bakery").pages[0]?.blocks[0];
      expect(first?.type, t.id).toBe("hero");
      expect((first?.config as { image_url?: string; headline?: string }).image_url, t.id).toMatch(/\/templates\/.+\.jpg$/);
      expect((first?.config as { headline?: string }).headline, t.id).toBeTruthy();
    }
  });

  it("gives the portfolio template a colour-led hero (no photo) and the website layout", () => {
    const starter = buildStarter("portfolio", "Jordan Lee");
    const first = starter.pages[0]?.blocks[0];
    expect(first?.type).toBe("hero");
    expect((first?.config as { image_url?: string }).image_url).toBeFalsy();
    expect((first?.config as { headline?: string }).headline).toBeTruthy();
    expect(starter.theme.layout).toBe("website");
  });

  it("writes the portfolio hero's subtext from the customer's 'what's your site about' answer", () => {
    const withAnswer = buildStarter("portfolio", "Jordan Lee", "I help people land their next role");
    expect((withAnswer.pages[0]?.blocks[0]?.config as { subtext?: string }).subtext).toBe("I help people land their next role");

    const withoutAnswer = buildStarter("portfolio", "Jordan Lee");
    expect((withoutAnswer.pages[0]?.blocks[0]?.config as { subtext?: string }).subtext).toMatch(/kind of thing people read/);

    const blank = buildStarter("portfolio", "Jordan Lee", "   ");
    expect((blank.pages[0]?.blocks[0]?.config as { subtext?: string }).subtext).toMatch(/kind of thing people read/);
  });

  it("trims a too-long 'what's your site about' answer instead of overflowing the hero", () => {
    const long = "x".repeat(ABOUT_MAX_LENGTH + 50);
    const starter = buildStarter("portfolio", "Jordan Lee", long);
    expect((starter.pages[0]?.blocks[0]?.config as { subtext?: string }).subtext).toHaveLength(ABOUT_MAX_LENGTH);
  });

  it("puts the customer's own photo in the banner of a website starter, and nowhere else", () => {
    const photo = "https://example.com/me.jpg";
    for (const id of ["portfolio", "weddings", "technology"]) {
      const hero = buildStarter(id, "X", undefined, photo).pages[0].blocks[0].config as { image_url?: string };
      expect(hero.image_url, id).toBe(photo);
    }
    // Blank stays blank; a phone-first starter keeps its own photo.
    expect((buildStarter("weddings", "X", undefined, "  ").pages[0].blocks[0].config as { image_url?: string }).image_url).toBe("");
    expect((buildStarter("business", "X", undefined, photo).pages[0].blocks[0].config as { image_url?: string }).image_url).toMatch(/business-hero\.jpg$/);
  });

  it("ignores the 'about' answer for a template that doesn't ask for one", () => {
    const starter = buildStarter("business", "Maple Street Bakery", "this should be ignored");
    expect(JSON.stringify(starter)).not.toContain("this should be ignored");
  });

  it("marks exactly the website templates as asking 'what's your site about', each with its own hints", () => {
    const asking = STARTER_TEMPLATES.filter((t) => t.asksAbout);
    expect(asking.map((t) => t.id)).toEqual(["portfolio", ...TOPIC_IDS]);
    expect(STARTER_TEMPLATES.filter((t) => t.category === "website").map((t) => t.id)).toEqual(asking.map((t) => t.id));
    for (const t of asking) {
      expect(t.nameHint, t.id).toBeTruthy();
      expect(t.aboutHint, t.id).toBeTruthy();
    }
  });

  it("gives every topic website the same core shape, its own words, and the website layout", () => {
    expect(WEBSITE_TOPICS.map((t) => t.id)).toEqual(TOPIC_IDS);
    const headlines = new Set<string>();
    for (const topic of WEBSITE_TOPICS) {
      const starter = buildStarter(topic.id, "X", "my own words");
      expect(starter.theme.layout, topic.id).toBe("website");
      expect(starter.pages.map((p) => p.path), topic.id).toEqual(["home", "about", "contact"]);
      // The core sections, in order, with the trade's extras (gallery, shop) allowed between them.
      const core = ["hero", "stats", "image_text", "reviews", "newsletter"];
      expect(starter.pages[0].blocks.map((b) => b.type).filter((t) => core.includes(t)), topic.id).toEqual(core);
      expect(starter.pages[2].blocks[0].type, topic.id).toBe("text");
      expect(starter.pages[2].blocks.at(-1)?.type, topic.id).toBe("contact_form");
      const hero = starter.pages[0].blocks[0].config as { headline?: string; subtext?: string; image_url?: string };
      expect(hero.image_url, topic.id).toBeFalsy();
      expect(hero.subtext, topic.id).toBe("my own words");
      headlines.add(hero.headline ?? "");
      // Every topic's colour is its own, so the picker's cards don't blur together.
      expect(STARTER_TEMPLATES.filter((t) => t.color === topic.color).map((t) => t.id), topic.color).toEqual([topic.id]);
    }
    expect(headlines.size).toBe(WEBSITE_TOPICS.length);
  });

  it("gives the topic websites five real flavours, all used, each readable back from the site's own theme", () => {
    expect([...new Set(WEBSITE_TOPICS.map((t) => t.style))].sort()).toEqual(["bold", "cinematic", "classic", "editorial", "split"]);
    for (const topic of WEBSITE_TOPICS) {
      const starter = buildStarter(topic.id, "X");
      const flavour = WEBSITE_STYLES[topic.style];
      expect(starter.theme, topic.id).toMatchObject(flavour.theme);
      expect(starter.theme.look, topic.id).toBe(topic.style);
      expect(starter.manifest.background_color, topic.id).toBe(flavour.theme.background_color);
      expect(websiteStyleOf(starter.theme), topic.id).toBe(topic.style);
      // The quote is on Home for editorial sites, on About for the rest — once, never twice.
      const onHome = starter.pages[0].blocks.filter((b) => b.type === "quote").length;
      const onAbout = starter.pages[1].blocks.filter((b) => b.type === "quote").length;
      expect([onHome, onAbout], topic.id).toEqual(flavour.quoteOnHome ? [1, 0] : [0, 1]);
    }
    // The flavours really are different sites, not the same theme under five names.
    expect(new Set(Object.values(WEBSITE_STYLES).map((s) => s.theme.font_pair)).size).toBe(5);
  });

  it("gives each trade the sections that fit it, in order, and nothing invented", () => {
    const EXTRA = ["gallery", "video", "audio", "price_list", "product_list", "map", "event_calendar", "faq", "hours"];
    const extras = (id: string) => {
      const s = buildStarter(id, "X");
      const on = (page: number) => s.pages[page].blocks.map((b) => b.type).filter((t) => EXTRA.includes(t));
      return { home: on(0), contact: on(2), events: s.events?.length ?? 0, products: s.products?.length ?? 0 };
    };
    const expected: Record<string, ReturnType<typeof extras>> = {
      photography: { home: ["gallery", "video"], contact: [], events: 0, products: 0 },
      weddings: { home: ["gallery", "video"], contact: [], events: 0, products: 0 },
      art: { home: ["gallery"], contact: [], events: 0, products: 0 },
      apparel: { home: ["gallery", "product_list"], contact: [], events: 0, products: 3 },
      music: { home: ["audio", "event_calendar"], contact: [], events: 3, products: 0 },
      travel: { home: ["event_calendar"], contact: [], events: 3, products: 0 },
      health: { home: ["price_list", "faq"], contact: ["event_calendar"], events: 3, products: 0 },
      beauty: { home: ["price_list"], contact: ["event_calendar"], events: 3, products: 0 },
      education: { home: [], contact: ["event_calendar"], events: 3, products: 0 },
      consulting: { home: ["faq"], contact: ["event_calendar"], events: 3, products: 0 },
      construction: { home: ["faq"], contact: ["hours"], events: 0, products: 0 },
      realestate: { home: ["map", "faq"], contact: [], events: 0, products: 0 },
      design: { home: [], contact: [], events: 0, products: 0 },
      marketing: { home: [], contact: [], events: 0, products: 0 },
      technology: { home: [], contact: [], events: 0, products: 0 },
    };
    expect(Object.keys(expected).sort()).toEqual([...TOPIC_IDS].sort());
    for (const [id, want] of Object.entries(expected)) expect(extras(id), id).toEqual(want);

    // The chips on a website card say exactly which extras its pages really have.
    const label: Record<string, string> = { gallery: "Gallery", video: "Video", audio: "Audio", price_list: "Prices", product_list: "Shop", map: "Map", event_calendar: "Bookings", faq: "FAQ", hours: "Hours" };
    for (const t of STARTER_TEMPLATES.filter((x) => x.category === "website")) {
      const have = new Set(buildStarter(t.id, "X").pages.flatMap((p) => p.blocks.map((b) => label[b.type])).filter(Boolean));
      expect(new Set(t.includes), t.id).toEqual(have);
    }

    // Nothing made up: no photos, videos or recordings, no address or phone anywhere, every sample says it is one.
    for (const topic of WEBSITE_TOPICS) {
      const s = buildStarter(topic.id, "X");
      for (const page of s.pages)
        for (const b of page.blocks) {
          const c = b.config as Record<string, unknown>;
          if (b.type === "gallery") expect(c.images, topic.id).toEqual([]);
          if (b.type === "video") expect(c.url, topic.id).toBe("");
          if (b.type === "audio") expect(c.src, topic.id).toBe("");
          if (b.type === "image_text") expect(c.image_url, topic.id).toBe("");
          if (b.type === "map") expect(c.address, topic.id).toBe("");
          if (b.type === "hours") expect([c.address, c.phone], topic.id).toEqual(["", ""]);
          if (b.type === "faq") expect((c.items as unknown[]).length, topic.id).toBeGreaterThanOrEqual(3);
        }
      for (const e of s.events ?? []) expect(e.description, topic.id).toContain("This is a sample");
      for (const p of s.products ?? []) {
        expect(p.description, topic.id).toContain("Sample product");
        expect(p.image, topic.id).toBeUndefined();
      }
    }
  });

  it("gives every hero button a page that exists in the same app", () => {
    for (const t of STARTER_TEMPLATES) {
      const starter = buildStarter(t.id, "x");
      const paths = new Set(starter.pages.map((p) => p.path));
      for (const p of starter.pages)
        for (const b of p.blocks)
          if (b.type === "hero" && (b.config as { button_page?: string }).button_page) expect(paths, `${t.id} hero button`).toContain((b.config as { button_page: string }).button_page);
    }
  });

  it("knows which starters use Google Maps", () => {
    expect(STARTER_TEMPLATES.filter((t) => templateNeedsMaps(t.id)).map((t) => t.id)).toEqual(["food", "gas"]);
  });

  it("puts the app's name in the header bar of every starter", () => {
    for (const t of STARTER_TEMPLATES) expect(buildStarter(t.id, "Maple Street Bakery").theme.header_title).toBe("Maple Street Bakery");
  });

  it("starts the blank template with an empty Home page", () => {
    const starter = buildStarter("blank", "X");
    expect(starter.pages).toEqual([{ name: "Home", path: "home", isHome: true, blocks: [] }]);
  });

  it("treats an unknown template as blank", () => {
    expect(buildStarter("whatever", "X").pages[0].blocks).toEqual([]);
  });
});

describe("website designs (a topic in each of the five looks)", () => {
  it("lists five designs per website starter, its own look first, and the bare id is that first design", () => {
    for (const topic of WEBSITE_TOPICS) expect(websiteDesigns(topic.id)[0]?.look).toBe(topic.style);
    expect(websiteDesigns("portfolio")[0]?.look).toBe("classic");
    for (const t of STARTER_TEMPLATES.filter((x) => x.category === "website")) {
      const designs = websiteDesigns(t.id);
      expect(designs[0]?.id).toBe(t.id);
      expect([...designs.map((d) => d.look)].sort()).toEqual([...LOOK_IDS].sort());
      expect(new Set(designs.map((d) => d.id)).size).toBe(LOOK_IDS.length);
    }
    for (const t of STARTER_TEMPLATES.filter((x) => x.category !== "website")) expect(websiteDesigns(t.id), t.id).toEqual([]);
  });

  it("builds each design as the same site (same words, same sections) in that look", () => {
    const shape = (s: ReturnType<typeof buildStarter>) => s.pages.map((p) => `${p.name}: ${p.blocks.filter((b) => b.type !== "quote").map((b) => b.type).join(",")}`);
    for (const t of STARTER_TEMPLATES.filter((x) => x.category === "website")) {
      const own = buildStarter(t.id, "X", "my words");
      for (const d of websiteDesigns(t.id)) {
        const s = buildStarter(d.id, "X", "my words");
        expect(s.theme.look, d.id).toBe(d.look);
        expect(s.theme.font_pair).toBe(WEBSITE_STYLES[d.look].theme.font_pair);
        expect(s.theme.background_color).toBe(WEBSITE_STYLES[d.look].theme.background_color);
        expect(s.theme.primary_color).toBe(t.color);
        expect(s.theme.layout).toBe("website");
        expect(shape(s), d.id).toEqual(shape(own));
        expect((s.pages[0]?.blocks[0]?.config as { headline?: string; subtext?: string }).subtext).toBe("my words");
      }
    }
  });

  it("accepts design ids wherever a template id goes, and rejects made-up ones", () => {
    expect(isTemplateId("photography--editorial")).toBe(true);
    expect(starterTemplateFor("photography--editorial")?.id).toBe("photography");
    expect(parseWebsiteDesign("photography--editorial")?.look).toBe("editorial");
    expect(isTemplateId("photography--neon")).toBe(false);
    expect(isTemplateId("business--editorial")).toBe(false);
    expect(isTemplateId("portfolio--bold")).toBe(true);
    expect(buildStarter("portfolio--bold", "X").theme.look).toBe("bold");
    expect(parseWebsiteDesign("business")).toBeUndefined();
    expect(starterTemplateFor("photography--neon")).toBeUndefined();
  });
});
