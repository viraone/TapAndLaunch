import { describe, expect, it } from "vitest";
import { GOAL_IDS, WEBSITE_GOALS, isGoalId } from "./goals";
import { STARTER_TEMPLATES, WEBSITE_TOPICS, buildStarter, websiteDesigns } from "./templates";

const count = (s: ReturnType<typeof buildStarter>, type: string) => s.pages.flatMap((p) => p.blocks).filter((b) => b.type === type).length;

describe("website goals", () => {
  it("each adds its section exactly once to a website that lacks it, on the right page, in every design", () => {
    for (const t of STARTER_TEMPLATES.filter((x) => x.category === "website")) {
      for (const d of websiteDesigns(t.id)) {
        const plain = buildStarter(d.templateId, "X");
        const all = buildStarter(d.templateId, "X", undefined, undefined, GOAL_IDS);
        for (const g of WEBSITE_GOALS) {
          expect(count(all, g.block), `${d.templateId} ${g.id}`).toBe(1);
          const page = all.pages.find((p) => p.blocks.some((b) => b.type === g.block));
          if (count(plain, g.block) === 0) expect(page?.path, `${d.templateId} ${g.id}`).toBe(g.page === "contact" ? "contact" : "home");
        }
        // Everything the plain starter had is still there, in order.
        const kept = (s: typeof plain) => s.pages.map((p) => p.blocks.map((b) => b.type).filter((x) => !GOAL_IDS.some((id) => WEBSITE_GOALS.find((g) => g.id === id)?.block === x && count(plain, x) === 0)));
        expect(kept(all)).toEqual(plain.pages.map((p) => p.blocks.map((b) => b.type)));
      }
    }
  });

  it("puts the work right after the banner (and the quote), lists before the reviews, Contact extras before the form", () => {
    const s = buildStarter("consulting--velvet", "X", undefined, undefined, ["gallery", "video", "prices", "shop", "hours", "map"]);
    const home = s.pages[0]!.blocks.map((b) => b.type);
    expect(home.slice(0, 4)).toEqual(["hero", "quote", "gallery", "video"]);
    expect(home.indexOf("price_list")).toBeLessThan(home.indexOf("reviews"));
    expect(home.indexOf("product_list")).toBeLessThan(home.indexOf("reviews"));
    const contact = s.pages.find((p) => p.path === "contact")!.blocks.map((b) => b.type);
    expect(contact.at(-1)).toBe("contact_form");
    expect(contact).toContain("hours");
    expect(contact).toContain("map");
  });

  it("brings sample appointments and products, unless the topic ships its own", () => {
    const photo = buildStarter("photography", "X", undefined, undefined, ["bookings", "shop"]);
    expect(photo.events?.length).toBeGreaterThan(0);
    expect(photo.products?.length).toBeGreaterThan(0);
    const apparel = WEBSITE_TOPICS.find((t) => t.id === "apparel")!;
    const shop = buildStarter("apparel", "X", undefined, undefined, ["shop"]);
    expect(shop.products).toEqual(apparel.sampleProducts);
    expect(count(shop, "product_list")).toBe(1);
  });

  it("does nothing for a phone-first template, an unknown goal, or no goals", () => {
    const plain = buildStarter("business", "X");
    expect(buildStarter("business", "X", undefined, undefined, ["gallery", "bookings"]).pages.map((p) => p.blocks.length)).toEqual(plain.pages.map((p) => p.blocks.length));
    const photo = buildStarter("photography", "X");
    expect(buildStarter("photography", "X", undefined, undefined, ["neon"]).pages.map((p) => p.blocks.length)).toEqual(photo.pages.map((p) => p.blocks.length));
    expect(buildStarter("photography", "X", undefined, undefined, []).pages.map((p) => p.blocks.length)).toEqual(photo.pages.map((p) => p.blocks.length));
    expect(isGoalId("gallery")).toBe(true);
    expect(isGoalId("neon")).toBe(false);
  });
});
