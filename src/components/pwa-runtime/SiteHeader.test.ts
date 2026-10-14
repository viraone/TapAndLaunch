import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeader } from "@/components/pwa-runtime/SiteHeader";
import type { ThemeConfig } from "@/types/database";

const THEME: ThemeConfig = {
  layout: "website",
  header_title: "David Babu Comedy",
  header_tagline: "Come laugh with me",
  bottom_nav: [
    { label: "Home", icon: "home", page_path: "home" },
    { label: "Shows", icon: "calendar", page_path: "shows" },
    { label: "", icon: "info", page_path: "broken" },
  ],
};

describe("SiteHeader", () => {
  it("shows the name and a menu of the pages, marking the current one", () => {
    const html = renderToStaticMarkup(createElement(SiteHeader, { theme: THEME, activePagePath: "shows" }));
    expect(html).toContain("David Babu Comedy");
    expect(html).toContain('href="/home"');
    expect(html).toContain('href="/shows"');
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain("broken"); // an entry without a label is not a menu item
  });

  it("uses buttons instead of links when the builder handles navigation", () => {
    const html = renderToStaticMarkup(createElement(SiteHeader, { theme: THEME, activePagePath: "home", onNavigate: () => {} }));
    expect(html).not.toContain('href="/shows"');
    expect(html).toContain("<button");
  });

  it("renders nothing for a theme with no header and no pages", () => {
    expect(renderToStaticMarkup(createElement(SiteHeader, { theme: {} }))).toBe("");
  });
});
