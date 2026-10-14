import { describe, expect, it } from "vitest";
import { collectConfigCopy, collectConfigCopyWithBlanks, isCopyPath, maxForPath, sanitize } from "./copy-fields";

describe("collectConfigCopy", () => {
  it("lists the words of a section by path, and nothing that is an address or a setting", () => {
    const config = { headline: "Hi", subtext: "", image_url: "https://x/y.jpg", button_page: "about", items: [{ quote: "Great", name: "Ann", rating: 5 }] };
    const keys = collectConfigCopy("hero", config).map((f) => f.key);
    expect(keys).toEqual(["headline"]);
    const reviews = collectConfigCopy("reviews", config).map((f) => f.key);
    expect(reviews).toEqual(["items/0/quote", "items/0/name"]);
  });

  it("can include blank fields so an instruction may fill them, but never a missing list item", () => {
    const config = { headline: "Hi", subtext: "" };
    const keys = collectConfigCopyWithBlanks("hero", config).map((f) => f.key);
    expect(keys).toEqual(["eyebrow", "headline", "subtext", "button_label"]);
    expect(collectConfigCopyWithBlanks("reviews", { items: [] })).toEqual([{ key: "title", text: "", max: 60, set: expect.any(Function) }]);
  });

  it("setters change the config in place", () => {
    const config: Record<string, unknown> = { items: [{ quote: "a", name: "b" }] };
    const [quote] = collectConfigCopy("reviews", config);
    quote.set("Better");
    expect((config.items as Array<{ quote: string }>)[0].quote).toBe("Better");
  });
});

describe("isCopyPath", () => {
  it("accepts the paths a section's words live at and rejects the rest", () => {
    expect(isCopyPath("hero", "headline")).toBe(true);
    expect(isCopyPath("reviews", "items.3.quote")).toBe(true);
    expect(isCopyPath("price_list", "sections.0.items.2.description")).toBe(true);
    expect(isCopyPath("hero", "image_url")).toBe(false);
    expect(isCopyPath("hero", "button_page")).toBe(false);
    expect(isCopyPath("reviews", "items.quote")).toBe(false);
    expect(isCopyPath("nope", "title")).toBe(false);
  });
  it("knows each field's limit by its last key", () => {
    expect(maxForPath("items.0.quote")).toBe(300);
    expect(maxForPath("whatever")).toBe(120);
  });
});

describe("sanitize", () => {
  it("strips tags and control characters and cuts on a word", () => {
    expect(sanitize("Hello <b>there</b>\u0007", 100)).toBe("Hello there");
    expect(sanitize("one two three four five", 11)).toBe("one two");
  });
});
