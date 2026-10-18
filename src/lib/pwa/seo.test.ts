import { describe, expect, it } from "vitest";
import { canonicalOrigin, excerpt, firstHeadedBlockIndex, pageDescription, pageJsonLd, pagePath, plainWords, publishedPageMetadata, shareImageUrl } from "./seo";

const app = {
  name: "Maple Street Bakery",
  custom_domain: null,
  custom_domain_status: null,
  manifest: { name: "Maple Street", description: "Fresh bread and pastries, baked every morning in Ballard." },
  theme: { header_tagline: "Baked every morning" },
};
const home = { name: "Home", path: "home", is_home: true };
const about = { name: "About", path: "about", is_home: false };
const contact = { name: "Contact", path: "contact", is_home: false };

describe("canonicalOrigin", () => {
  it("prefers a connected custom domain over the address the page was opened at", () => {
    expect(canonicalOrigin({ custom_domain: "maplestreet.com", custom_domain_status: "verified" }, "maple.tapandlaunch.com")).toBe("https://maplestreet.com");
  });
  it("ignores a domain that is not connected yet", () => {
    expect(canonicalOrigin({ custom_domain: "maplestreet.com", custom_domain_status: "pending" }, "maple.tapandlaunch.com")).toBe("https://maple.tapandlaunch.com");
    expect(canonicalOrigin(app, "maple.localhost:3100")).toBe("http://maple.localhost:3100");
  });
});

describe("pagePath", () => {
  it("files the home page under / and the rest under their path", () => {
    expect(pagePath(home)).toBe("/");
    expect(pagePath(about)).toBe("/about");
  });
});

describe("firstHeadedBlockIndex", () => {
  it("picks the first section that has a heading", () => {
    expect(firstHeadedBlockIndex([{ type: "stats", config: {} }, { type: "hero", config: { headline: "" } }, { type: "text", config: { heading: "Hi" } }])).toBe(2);
  });
  it("is -1 when no section has one", () => {
    expect(firstHeadedBlockIndex([{ type: "gallery", config: { images: [] } }])).toBe(-1);
  });
});

describe("plainWords and excerpt", () => {
  it("drops rich-text marks and keeps the words", () => {
    expect(plainWords("**Fresh** _bread_ from [our shop](https://x.com)\n- daily\n- early")).toBe("Fresh bread from our shop daily early");
  });
  it("cuts a long text at a word", () => {
    const long = "word ".repeat(60).trim();
    const cut = excerpt(long, 50);
    expect(cut.length).toBeLessThanOrEqual(51);
    expect(cut.endsWith("…")).toBe(true);
    expect(excerpt("short")).toBe("short");
  });
});

describe("pageDescription", () => {
  it("lets the page's own description win", () => {
    expect(pageDescription(app, { ...home, seo_description: " Our story. " }, [])).toBe("Our story.");
  });
  it("gives the home page the app's description and other pages their own first words", () => {
    expect(pageDescription(app, home, [{ type: "hero", config: { subtext: "Come in" } }])).toBe(app.manifest.description);
    expect(pageDescription(app, about, [{ type: "hero", config: { subtext: "Come in" } }, { type: "text", config: { body: "Long story" } }])).toBe("Come in");
    expect(pageDescription(app, about, [{ type: "text", config: { body: "**Started** in 1999." } }])).toBe("Started in 1999.");
  });
  it("never leaves two wordless pages with the same description", () => {
    const a = pageDescription(app, about, []);
    const b = pageDescription(app, contact, []);
    expect(a).toBe("About: Fresh bread and pastries, baked every morning in Ballard.");
    expect(a).not.toBe(b);
    expect(pageDescription({ name: "Shop", manifest: {} }, about, [])).toBe("About at Shop.");
  });
});

describe("shareImageUrl", () => {
  it("uses the page's picture, made absolute, else the drawn card", () => {
    expect(shareImageUrl({ ...home, share_image_url: "/storage/pic.jpg" }, "https://maple.com")).toBe("https://maple.com/storage/pic.jpg");
    expect(shareImageUrl(home, "https://maple.com")).toBe("https://maple.com/share-image");
    expect(shareImageUrl(about, "https://maple.com")).toBe("https://maple.com/share-image?page=about");
  });
});

describe("publishedPageMetadata", () => {
  it("sets the canonical address, the share tags and the card", () => {
    const meta = publishedPageMetadata(app, about, [{ type: "text", config: { body: "Since 1999." } }], "https://maple.com");
    expect(meta.title).toBe("About · Maple Street");
    expect(meta.description).toBe("Since 1999.");
    expect(meta.alternates?.canonical).toBe("https://maple.com/about");
    expect(meta.openGraph).toMatchObject({ type: "website", url: "https://maple.com/about", siteName: "Maple Street" });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: ["https://maple.com/share-image?page=about"] });
  });
});

describe("pageJsonLd", () => {
  it("describes the site, the organization and the page, with the FAQ when there is one", () => {
    const data = pageJsonLd(app, home, [{ type: "faq", config: { items: [{ question: "Gluten free?", answer: "Yes, on **Fridays**." }, { question: "", answer: "no" }] } }], "https://maple.com");
    const graph = data["@graph"] as Array<Record<string, unknown>>;
    expect(graph.map((g) => g["@type"])).toEqual(["WebSite", "Organization", "WebPage", "FAQPage"]);
    expect(graph[1]).toMatchObject({ name: "Maple Street", logo: "https://maple.com/app-icon?size=512" });
    expect(graph[2]).toMatchObject({ url: "https://maple.com/", name: "Maple Street: Baked every morning" });
    expect(graph[3]).toMatchObject({ mainEntity: [{ name: "Gluten free?", acceptedAnswer: { text: "Yes, on Fridays." } }] });
  });
  it("leaves the FAQ out when the page has none", () => {
    const graph = pageJsonLd(app, about, [], "https://maple.com")["@graph"] as unknown[];
    expect(graph).toHaveLength(3);
  });
});
