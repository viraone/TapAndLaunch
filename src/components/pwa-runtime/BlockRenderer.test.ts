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

  it("waits for the browser's clock once listings are passed", () => {
    const html = render(
      { type: "listing_directory", config: { title: "Tonight" } },
      [{ slug: "a", record: {} }, { slug: "b", record: {} }]
    );
    expect(html).toContain("Loading today&#x27;s open mics…");
    expect(html).not.toContain("when published");
  });

  it("renders no heading when the block has no title", () => {
    const html = render({ type: "listing_directory", config: {} });
    expect(html).not.toContain("<h2");
  });
});

describe("food_directory blocks in the builder", () => {
  it("show sample restaurants in the finished app's look, not an empty box", () => {
    const html = render({ type: "food_directory", config: { title: "Food near me" } });
    expect(html).toContain("Food near me");
    expect(html).toContain("Golden Bowl Ramen");
    expect(html).toContain("What are you craving?");
    expect(html).toContain("Sample places.");
    expect(html).not.toContain("border-dashed");
  });
});
