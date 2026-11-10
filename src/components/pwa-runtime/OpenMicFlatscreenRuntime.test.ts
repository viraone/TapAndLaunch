import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { OpenMicFlatscreenRuntime, TvTimerPanel } from "./OpenMicFlatscreenRuntime";
import type { OpenMicSignupBlockConfig } from "@/types/database";

function render(config: OpenMicSignupBlockConfig) {
  return renderToStaticMarkup(createElement(OpenMicFlatscreenRuntime, { config }));
}

describe("OpenMicFlatscreenRuntime", () => {
  it("shows the flyer with the show's name in its alt text", () => {
    const html = render({ view: "tv", flyer_url: "https://example.com/flyer.jpg", show_name: "Read The Room" });

    expect(html).toContain("https://example.com/flyer.jpg");
    expect(html).toContain("Read The Room flyer");
  });

  it("says there is no flyer yet when none is set", () => {
    const html = render({ view: "tv" });

    expect(html).toContain("No flyer yet.");
    expect(html).not.toContain("<img");
  });
});

describe("TvTimerPanel", () => {
  it("shows the performing comic with the time left, the bar and who is next", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", next: "Evan Hales", ms: 120000, totalMs: 180000, running: true }));

    expect(html).toContain("Performing");
    expect(html).toContain("Karen Young");
    expect(html).toContain("Next: Evan Hales");
    expect(html).toContain("2:00");
    expect(html).toContain("width:33.33");
    expect(html).toContain("bg-primary");
    expect(html).toContain("text-[15rem]");
    expect(html).not.toContain("bg-amber-400");
    expect(html).not.toContain("On deck");
  });

  it("leads with the next comic's name between comics, with the set length as a pill and no clock", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Evan Hales", next: "Test Jones 1", ms: 180000, totalMs: 180000, running: false }));

    expect(html).toContain("On deck");
    expect(html).toContain("Evan Hales");
    expect(html).toContain("3 min");
    expect(html).toContain("then Test Jones 1");
    expect(html).not.toContain("3:00");
    expect(html).not.toContain("Performing");
    expect(html).not.toContain("animate-pulse");
  });

  it("leaves out who is next for the last comic", () => {
    const idle = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Evan Hales", ms: 180000, totalMs: 180000, running: false }));
    const running = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Evan Hales", ms: 120000, totalMs: 180000, running: true }));

    expect(idle).not.toContain("then ");
    expect(running).not.toContain("Next:");
  });

  it("turns the whole box amber with 30 seconds left, with no label", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", next: "Evan Hales", ms: 25000, totalMs: 180000, running: true }));

    expect(html).toContain("0:25");
    expect(html).toContain("bg-amber-400");
    expect(html).toContain("text-black");
    expect(html).toContain("Next: Evan Hales");
    expect(html).not.toContain("30 sec left");
    expect(html).not.toContain("Performing");
  });

  it("stays amber with 8 seconds left, with no label", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", ms: 8000, totalMs: 180000, running: true }));

    expect(html).toContain("0:08");
    expect(html).toContain("bg-amber-400");
    expect(html).not.toContain("Wrap");
    expect(html).not.toContain("bg-red-500");
  });

  it("turns white with black digits and counts up past the set length, with no label, no red and no flashing", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", ms: -12000, totalMs: 180000, running: true }));

    expect(html).toContain("+0:12");
    expect(html).toContain("bg-white");
    expect(html).toContain("text-black");
    expect(html).toContain("width:100%");
    expect(html).toContain("text-[11rem]");
    expect(html).not.toContain("Over time");
    expect(html).not.toContain("Wrap");
    expect(html).not.toContain("bg-red");
    expect(html).not.toContain("animate-");
  });
});
