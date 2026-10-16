import { describe, expect, it } from "vitest";
import { pageTitle } from "./page-title";

const app = { name: "Bakery", manifest: { name: "Maple Street" } };

describe("pageTitle", () => {
  it("titles the home page with the app's name, never leaving it empty", () => {
    expect(pageTitle(app, { name: "Home", is_home: true })).toBe("Maple Street");
    expect(pageTitle({ name: "Bakery", manifest: {} }, { name: "Home", is_home: true })).toBe("Bakery");
    expect(pageTitle({ name: "Bakery", manifest: { name: "  " } }, { name: "Home", is_home: true })).toBe("Bakery");
  });
  it("titles other pages as 'Page · App'", () => {
    expect(pageTitle(app, { name: "Shows", is_home: false })).toBe("Shows · Maple Street");
  });
  it("lets a page's own SEO title win", () => {
    expect(pageTitle(app, { name: "Home", is_home: true, seo_title: "Best bread in Seattle" })).toBe("Best bread in Seattle");
    expect(pageTitle(app, { name: "Home", is_home: true, seo_title: "   " })).toBe("Maple Street");
  });
});
