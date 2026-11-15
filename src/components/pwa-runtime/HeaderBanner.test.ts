import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeaderBanner } from "./HeaderBanner";

const render = (banner: { title: string; url: string; label?: string; sub?: string; button?: string }) =>
  renderToStaticMarkup(createElement(HeaderBanner, { banner }));

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
});
