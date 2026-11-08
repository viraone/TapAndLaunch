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
  it("shows who is on stage with the time left and who is next", () => {
    const html = renderToStaticMarkup(
      createElement(TvTimerPanel, { timer: { kind: "on", name: "Viradeth", remainingMs: 180000, totalMs: 300000, nextName: "Karen Young", nextAt: "7:05 PM" } })
    );

    expect(html).toContain("On stage");
    expect(html).toContain("Viradeth");
    expect(html).toContain("3:00");
    expect(html).toContain("Next up");
    expect(html).toContain("Karen Young");
    expect(html).toContain("7:05 PM");
    expect(html).toContain("width:40%");
    expect(html).not.toContain("text-red-500");
  });

  it("shows over time in red with a full bar", () => {
    const html = renderToStaticMarkup(
      createElement(TvTimerPanel, { timer: { kind: "on", name: "Viradeth", remainingMs: -15000, totalMs: 300000, nextName: "Karen Young", nextAt: "7:05 PM" } })
    );

    expect(html).toContain("+0:15");
    expect(html).toContain("text-red-500");
    expect(html).toContain("width:100%");
  });

  it("shows only who is next when nobody is on stage", () => {
    const html = renderToStaticMarkup(
      createElement(TvTimerPanel, { timer: { kind: "idle", nextName: "Viradeth", nextAt: "7:00 PM" } })
    );

    expect(html).toContain("Next up");
    expect(html).toContain("Viradeth");
    expect(html).toContain("7:00 PM");
    expect(html).not.toContain("On stage");
  });
});
