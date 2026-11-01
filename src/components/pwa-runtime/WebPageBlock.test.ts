import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WebPageBlockConfig } from "@/types/database";
import { WebPageBlock } from "./WebPageBlock";

function render(config: WebPageBlockConfig, live = true) {
  return renderToStaticMarkup(createElement(WebPageBlock, { config, live }));
}

describe("web_page blocks", () => {
  it("shows an https page in the iframe and offers a plain link underneath", () => {
    const html = render({
      url: "https://example.com/",
      title: "Example",
      height: "tall",
      allow_location: true,
    });
    expect(html).toContain('src="https://example.com/"');
    expect(html).toContain('title="Example"');
    expect(html).toContain("w-full border-0 h-[40rem]");
    expect(html).toContain('loading="lazy"');
    // React 19's server renderer keeps the prop's camelCase here; HTML attribute names are case-insensitive.
    expect(html).toContain('referrerPolicy="no-referrer-when-downgrade"');
    expect(html).toContain('allow="geolocation"');
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener"');
    expect(html).toContain("Open in your browser");
  });

  it("fills the screen by default and does not ask for location", () => {
    const html = render({ url: "https://example.com" });
    expect(html).toContain("w-full border-0 h-[calc(100dvh-12rem)] min-h-[24rem]");
    expect(html).toContain('title="Web page"');
    expect(html).not.toContain('allow="geolocation"');
  });

  it("uses the short height when asked", () => {
    expect(render({ url: "https://example.com", height: "short" })).toContain("w-full border-0 h-[24rem]");
  });

  it("renders nothing on the live site without an https address", () => {
    expect(render({ url: "" })).toBe("");
    expect(render({ url: "http://example.com" })).toBe("");
    expect(render({ url: "example.com" })).toBe("");
  });

  it("shows a hint in the builder instead", () => {
    expect(render({ url: "" }, false)).toContain("Add a web address starting with https://");
    expect(render({ url: "http://example.com" }, false)).toContain("Add a web address starting with https://");
  });
});
