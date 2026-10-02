import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingDirectoryBlockEditor } from "@/components/builder/blocks/ListingDirectoryBlockEditor";
import { Inspector } from "@/components/builder/Inspector";

describe("ListingDirectoryBlockEditor", () => {
  it("renders the title input and time zone note for a full config", () => {
    const html = renderToStaticMarkup(
      createElement(ListingDirectoryBlockEditor, {
        config: { title: "Open mics today", time_zone: "America/Los_Angeles" },
        onChange: () => {},
      })
    );
    expect(html).toContain('id="listing-directory-title"');
    expect(html).toContain('value="Open mics today"');
    expect(html).toContain("Time zone: America/Los_Angeles");
  });

  it("falls back to an empty title and the default time zone", () => {
    const html = renderToStaticMarkup(
      createElement(ListingDirectoryBlockEditor, {
        config: {},
        onChange: () => {},
      })
    );
    expect(html).toContain('value=""');
    expect(html).toContain("Time zone: America/Los_Angeles");
  });

  it("Inspector renders the listing_directory editor for a listing_directory block", () => {
    const html = renderToStaticMarkup(
      createElement(Inspector, {
        block: { id: "b1", type: "listing_directory", config: { title: "Tonight", time_zone: "America/Los_Angeles" }, minTier: null },
        appId: "a",
        organizationId: "o",
        onChange: () => {},
        onMinTierChange: () => {},
        pageName: "Home",
        blocks: [],
        onSelect: () => {},
        onClose: () => {},
      })
    );
    expect(html).toContain("Listing directory");
    expect(html).toContain('id="listing-directory-title"');
    expect(html).toContain('value="Tonight"');
  });
});
