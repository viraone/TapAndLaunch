import { describe, expect, it } from "vitest";
import { hasFormatting, parseInline, parseRichText } from "@/lib/rich-text";

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
