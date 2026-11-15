import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ThemeConfig } from "@/types/database";
import { AppHeader } from "./AppHeader";

const LOGO = "https://example.com/logo.png";
const render = (theme: Partial<ThemeConfig>) => renderToStaticMarkup(createElement(AppHeader, { theme: theme as ThemeConfig }));

describe("AppHeader", () => {
  it("shows the name when the theme has one", () => {
    const html = render({ header_title: "Read The Room", header_logo_url: LOGO });
    expect(html).toContain("Read The Room");
    expect(html).toContain(LOGO);
  });

  it("keeps the bar, the logo and the text column when the name is empty", () => {
    const html = render({ header_title: "", header_logo_url: LOGO });
    expect(html).toContain("<header");
    expect(html).toContain(LOGO);
    expect(html).toContain('<div class="min-w-0">');
    expect(html).not.toContain("text-2xl");
  });

  it("renders nothing when the theme asks for no header", () => {
    expect(render({})).toBe("");
  });

  it("shows the banner instead of the logo when the banner is active", () => {
    const html = render({ header_logo_url: LOGO, header_banner: { title: "Thanksgiving Leftovers", url: "https://example.com/x" } });
    expect(html).toContain("Thanksgiving Leftovers");
    expect(html).toContain('href="https://example.com/x"');
    expect(html).not.toContain(LOGO);
  });

  it("shows the logo when the banner is expired", () => {
    const html = render({ header_logo_url: LOGO, header_banner: { title: "Thanksgiving Leftovers", url: "https://example.com/x", until: "2000-01-01" } });
    expect(html).toContain(LOGO);
    expect(html).not.toContain("Thanksgiving Leftovers");
  });

  it("shows the corner link inside the banner", () => {
    const html = render({ header_logo_url: LOGO, header_action: { label: "Profile", icon: "user", page_path: "profile" }, header_banner: { title: "Thanksgiving Leftovers", url: "https://example.com/x" } });
    expect(html).toContain('href="/profile"');
    expect(html).toContain("Thanksgiving Leftovers");
    expect(html).not.toContain(LOGO);
  });

  it("shows the banner by default", () => {
    const html = render({ header_title: "Show", header_banner: { title: "Big show", url: "https://example.com/tix", image: "/x.jpg", until: "2099-01-01" } });
    expect(html).toContain('href="https://example.com/tix"');
  });

  it("hideBanner shows the logo header instead", () => {
    const html = renderToStaticMarkup(createElement(AppHeader, { theme: { header_title: "Show", header_banner: { title: "Big show", url: "https://example.com/tix", image: "/x.jpg", until: "2099-01-01" } } as ThemeConfig, hideBanner: true }));
    expect(html).not.toContain("https://example.com/tix");
    expect(html).toContain("Show");
  });
});
