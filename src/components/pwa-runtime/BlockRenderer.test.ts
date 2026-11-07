import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { BlockRenderer, type RenderableBlock } from "@/components/pwa-runtime/BlockRenderer";
import type { RuntimeEvent } from "@/components/pwa-runtime/EventBookRuntime";
import type { RuntimeListing } from "@/lib/pwa/listings";

function render(block: RenderableBlock, listings?: RuntimeListing[], events?: RuntimeEvent[]) {
  return renderToStaticMarkup(
    createElement(BlockRenderer, {
      block,
      ...(listings !== undefined ? { listings } : {}),
      ...(events !== undefined ? { events } : {}),
    })
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

describe("automation blocks in the builder", () => {
  it("shows a private placeholder instead of the owner's screen", () => {
    const html = render({ type: "open_mic_signup", config: { view: "automation" } });
    expect(html).toContain("Automation (private)");
    expect(html).not.toContain("Connect Gmail");
  });
});

describe("event_calendar blocks", () => {
  function makeEvent(title: string): RuntimeEvent {
    return {
      id: "a",
      title,
      description: null,
      location: null,
      starts_at: "2026-11-06T19:00:00-08:00",
      ends_at: null,
      capacity: null,
      bookedCount: 0,
    };
  }

  it("draws the month view when the block's view is month", () => {
    const html = render({ type: "event_calendar", config: { title: "Calendar", view: "month" } }, undefined, [
      makeEvent("First Night"),
    ]);

    expect(html).toContain("Calendar");
    expect(html).toContain("November 2026");
    expect(html).toContain("Previous month");
    expect(html).toContain("Next month");
    expect(html).toContain("First Night");
  });

  it("keeps the Book button when booking is not turned off", () => {
    const html = render({ type: "event_calendar", config: { title: "Calendar" } }, undefined, [
      makeEvent("First Night"),
    ]);

    expect(html).toContain("First Night");
    expect(html).toContain(">Book<");
  });

  it("hides the booking controls in the list when the block turns booking off", () => {
    const html = render({ type: "event_calendar", config: { title: "Calendar", booking: false } }, undefined, [
      { ...makeEvent("First Night"), ticket_url: "https://example.com/tickets" },
    ]);

    expect(html).toContain("First Night");
    expect(html).not.toContain(">Book<");
    expect(html).not.toContain("Tickets");
    expect(html).not.toContain("Fully booked");
  });

  it("hides the Book button in the month view when the block turns booking off", () => {
    const html = render(
      { type: "event_calendar", config: { title: "Calendar", view: "month", booking: false } },
      undefined,
      [makeEvent("First Night")]
    );

    expect(html).toContain("First Night");
    expect(html).not.toContain(">Book<");
  });
});
