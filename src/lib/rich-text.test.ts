import { describe, expect, it } from "vitest";
import { hasFormatting, isContactHref, linkHref, parseInline, parseRichText } from "@/lib/rich-text";

describe("rich text", () => {
  it("reads bold, italic and links in a line", () => {
    expect(parseInline("See **our shows** at [the club](https://example.com) _tonight_")).toEqual([
      { text: "See " },
      { text: "our shows", bold: true },
      { text: " at " },
      { text: "the club", href: "https://example.com" },
      { text: " " },
      { text: "tonight", italic: true },
    ]);
  });

  it("drops a link whose address is not http or https, keeping its words", () => {
    expect(parseInline("[click](javascript:alert)")).toEqual([{ text: "click" }]);
  });

  it("keeps a phone or email link, so a number on the page is tap-to-call", () => {
    expect(parseInline("call or text [206-617-3696](tel:+12066173696) or [write](mailto:hi@example.com)")).toEqual([
      { text: "call or text " },
      { text: "206-617-3696", href: "tel:+12066173696" },
      { text: " or " },
      { text: "write", href: "mailto:hi@example.com" },
    ]);
    expect(parseInline("[x](tel:abc)")).toEqual([{ text: "x" }]);
    expect(hasFormatting("ring [us](tel:+12065550100)")).toBe(true);
    expect(isContactHref("tel:+12065550100")).toBe(true);
    expect(isContactHref("https://example.com")).toBe(false);
  });

  it("turns what the owner types into the link box into an address", () => {
    expect(linkHref("example.com/menu")).toBe("https://example.com/menu");
    expect(linkHref("https://example.com")).toBe("https://example.com");
    expect(linkHref("(206) 617-3696")).toBe("tel:+12066173696");
    expect(linkHref("1-206-617-3696")).toBe("tel:+12066173696");
    expect(linkHref("+44 20 7946 0958")).toBe("tel:+442079460958");
    expect(linkHref("hi@example.com")).toBe("mailto:hi@example.com");
    expect(linkHref("mailto:hi@example.com")).toBe("mailto:hi@example.com");
  });

  it("leaves underscores inside words alone", () => {
    expect(parseInline("snake_case_name")).toEqual([{ text: "snake_case_name" }]);
  });

  it("splits paragraphs on empty lines, keeps line breaks, and gathers bullets", () => {
    expect(parseRichText("One\ntwo\n\n- a\n- **b**\n\nThree")).toEqual([
      { type: "p", lines: [[{ text: "One" }], [{ text: "two" }]] },
      { type: "ul", items: [[{ text: "a" }], [{ text: "b", bold: true }]] },
      { type: "p", lines: [[{ text: "Three" }]] },
    ]);
  });

  it("knows plain text from formatted text", () => {
    expect(hasFormatting("Just words, with_underscores and a - dash")).toBe(false);
    expect(hasFormatting("- a bullet")).toBe(true);
    expect(hasFormatting("some **bold**")).toBe(true);
  });
});
