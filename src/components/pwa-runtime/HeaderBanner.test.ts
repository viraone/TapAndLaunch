import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeaderBanner } from "./HeaderBanner";

const render = (banner: { title: string; url: string; label?: string; sub?: string; button?: string; big?: string; chips?: Array<{ text: string; icon?: "clock" | "mic" }> }, corner?: React.ReactNode) =>
  renderToStaticMarkup(createElement(HeaderBanner, { banner, corner }));

describe("HeaderBanner", () => {
  it("shows all optional parts and the link attributes", () => {
    const html = render({ title: "Thanksgiving Leftovers", url: "https://example.com/x", label: "Holiday", sub: "Warm up the plate", button: "Order" });
    expect(html).toContain("Holiday");
    expect(html).toContain("Thanksgiving Leftovers");
    expect(html).toContain("Warm up the plate");
    expect(html).toContain("Order");
    expect(html).toContain('href="https://example.com/x"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("omits optional spans when only title and url are given", () => {
    const html = render({ title: "Thanksgiving Leftovers", url: "https://example.com/x" });
    expect(html).not.toContain("uppercase");
    expect(html).not.toContain("rounded-full");
  });

  it("shows the corner and reserves space for it", () => {
    const html = render({ title: "Thanksgiving Leftovers", url: "https://example.com/x" }, createElement("span", null, "CORNER"));
    expect(html).toContain("CORNER");
    expect(html).toContain("absolute");
    expect(html).toContain("min-h-10");
  });

  it("splits the sub line on the dot and drops the trailing arrow from the button", () => {
    const html = render({ title: "T", url: "https://example.com/x", sub: "Free with a food donation · Ballard Food Bank", button: "Get tickets →" });
    expect(html).toContain("<br/>");
    expect(html).toContain("Ballard Food Bank");
    expect(html).toContain("Get tickets");
    expect(html).not.toContain("→");
  });

  it("draws the ghost numeral only when big is given", () => {
    const html = render({ title: "T", url: "https://example.com/x", big: "27" });
    expect(html).toContain(">27<");
    expect(html).toContain("text-[150px]");
    const html2 = render({ title: "T", url: "https://example.com/x" });
    expect(html2).not.toContain("text-[150px]");
  });

  it("shows info chips with their icons and omits the row without chips", () => {
    const html = render({ title: "T", url: "https://example.com/x", chips: [{ text: "Seating 6:30 · Show 7:30", icon: "clock" }, { text: "Karaoke after", icon: "mic" }] });
    expect(html).toContain("Seating 6:30 · Show 7:30");
    expect(html).toContain("Karaoke after");
    expect(html).toContain("<circle");
    expect(html).toContain("<rect");
    const html2 = render({ title: "T", url: "https://example.com/x" });
    expect(html2).not.toContain("Seating");
  });

  it("has the warm gradient and a live dot beside the label", () => {
    const html = render({ title: "T", url: "https://example.com/x", label: "Food drive" });
    expect(html).toContain("linear-gradient(155deg");
    expect(html).toContain("bg-[#e8442a]");
  });
});
