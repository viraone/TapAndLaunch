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
  it("shows the performing comic with the time left and the bar", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", ms: 120000, totalMs: 180000, running: true }));

    expect(html).toContain("Performing");
    expect(html).toContain("Karen Young");
    expect(html).toContain("2:00");
    expect(html).toContain("width:33.33");
    expect(html).not.toContain("text-red-500");
    expect(html).not.toContain("On deck");
  });

  it("turns red past the set length", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", ms: -15000, totalMs: 180000, running: true }));

    expect(html).toContain("+0:15");
    expect(html).toContain("text-red-500");
    expect(html).toContain("width:100%");
  });

  it("shows the next comic and their set length, still, between comics", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Evan Hales", ms: 180000, totalMs: 180000, running: false }));

    expect(html).toContain("On deck");
    expect(html).toContain("Evan Hales");
    expect(html).toContain("3:00");
    expect(html).not.toContain("Performing");
    expect(html).not.toContain("rounded-full bg-white/15");
  });
});
