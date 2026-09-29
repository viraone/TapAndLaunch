import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { BlockRenderer, type RenderableBlock } from "@/components/pwa-runtime/BlockRenderer";
import type { RuntimeListing } from "@/lib/pwa/listings";

function render(block: RenderableBlock, listings?: RuntimeListing[]) {
  return renderToStaticMarkup(
    createElement(BlockRenderer, { block, ...(listings !== undefined ? { listings } : {}) })
  );
}

describe("listing_directory blocks", () => {
  it("shows the title and a placeholder when no listings are passed", () => {
    const html = render({ type: "listing_directory", config: { title: "Tonight" } });
    expect(html).toContain("Tonight");
    expect(html).toContain("Shows the open mics happening today when published.");
  });

  it("shows how many listings were loaded once they are passed", () => {
    const html = render(
      { type: "listing_directory", config: { title: "Tonight" } },
      [{ slug: "a", record: {} }, { slug: "b", record: {} }]
    );
    expect(html).toContain("2 open mics listed.");
    expect(html).not.toContain("when published");
  });

  it("renders no heading when the block has no title", () => {
    const html = render({ type: "listing_directory", config: {} });
    expect(html).not.toContain("<h2");
  });
});
