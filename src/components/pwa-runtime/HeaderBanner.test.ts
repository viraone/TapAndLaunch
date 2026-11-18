import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeaderBanner } from "./HeaderBanner";

const render = (banner: { title: string; url: string; label?: string; sub?: string; button?: string; big?: string; image?: string; chips?: Array<{ text: string; icon?: "clock" | "mic" }> }, corner?: React.ReactNode) =>
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

  it("shows the flyer instead of the big title and sub when image is given", () => {
    const html = render({ title: "Thanksgiving Leftovers", url: "https://example.com/x", image: "/promos/x.jpg", sub: "Ballard Food Bank", label: "Food drive", button: "Get tickets", chips: [{ text: "Seating 6:30" }] });
    expect(html).toContain("<img");
    expect(html).toContain('src="/promos/x.jpg"');
    expect(html).toContain('alt="Thanksgiving Leftovers"');
    expect(html).toContain("sr-only");
    expect(html).toContain("Seating 6:30");
    expect(html).toContain("Get tickets");
    expect(html).not.toContain("text-[34px]");
    expect(html).not.toContain("Ballard Food Bank");
    const html2 = render({ title: "T", url: "https://example.com/x" });
    expect(html2).not.toContain("<img");
  });

  it("fills the card edge to edge when image has no label, chips, or button", () => {
    const html = render({ title: "Show", url: "https://example.com", image: "/x.jpg" });
    expect(html).toContain('class="relative block h-auto w-full"');
    expect(html).not.toContain("p-3.5");
    expect(html).not.toContain("mt-3");
  });

  it("keeps the flyer edge to edge with the button pill above it", () => {
    const html = render({ title: "Show", url: "https://example.com", image: "/x.jpg", button: "Tickets →" });
    expect(html).toContain('class="relative block h-auto w-full rounded-3xl"');
    expect(html).not.toContain("linear-gradient");
    expect(html).toContain("bg-white");
    expect(html).not.toContain("=======");
    expect(html).toContain("Tickets");
    expect(html).toContain("mx-3.5 mb-2 mt-3.5");
    expect(html.indexOf("Tickets")).toBeLessThan(html.indexOf("<img"));
    expect(html).not.toContain("p-3.5");
    expect(html).toContain("motion-safe:animate-ping");
    expect(html).toContain("bg-[#e8442a]");
    expect(html).toContain("stroke-dasharray");
  });

  it("keeps padding and rounding when image has a label and a button", () => {
    const html = render({ title: "Show", url: "https://example.com", image: "/x.jpg", label: "Food drive", button: "Tickets →" });
    expect(html).toContain("rounded-2xl");
    expect(html).toContain("p-3.5");
  });
});
