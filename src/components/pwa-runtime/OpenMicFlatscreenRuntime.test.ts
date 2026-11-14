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

  it("fills the space around the flyer with a blurred copy of it, behind the sharp one", () => {
    const html = render({ view: "tv", flyer_url: "https://example.com/flyer.jpg", show_name: "Read The Room" });

    expect(html.split("<img").length - 1).toBe(2);
    expect(html).toContain("blur-3xl");
    expect(html).toContain("object-contain");
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
    expect(html).toContain(">On deck<");
    expect(html).toContain("Evan Hales");
    expect(html).toContain("2:00");
    expect(html).toContain("width:66.66");
    expect(html.split("-translate-x-1/2").length - 1).toBe(2);
    expect(html).toContain("bg-primary");
    expect(html).toContain("text-[16rem]");
    expect(html).not.toContain("bg-amber-400");
    expect(html).not.toContain("px-7 py-2 text-4xl");
    expect(html).toContain("text-8xl font-black");
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
    expect(running).not.toContain("On deck");
  });

  it("turns the whole box amber with 30 seconds left, with no label", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", next: "Evan Hales", ms: 25000, totalMs: 180000, running: true }));

    expect(html).toContain("0:25");
    expect(html).toContain("bg-amber-400");
    expect(html).toContain("text-black");
    expect(html).toContain(">On deck<");
    expect(html).toContain("Evan Hales");
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

  it("turns solid red with white digits and counts up past the set length, with no label and no flashing", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", ms: -12000, totalMs: 180000, running: true }));

    expect(html).toContain("+0:12");
    expect(html).not.toContain("-translate-x-1/2");
    expect(html).toContain("bg-red-600");
    expect(html).toContain("text-white");
    expect(html).toContain("width:100%");
    expect(html).toContain("text-[12rem]");
    expect(html).not.toContain("Over time");
    expect(html).not.toContain("Wrap");
    expect(html).not.toContain("animate-");
  });

  it("shows only the 0:30 tick when the set is shorter than a minute", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", ms: 40000, totalMs: 45000, running: true }));
    expect(html.split("-translate-x-1/2").length - 1).toBe(1);
  });

  it("shows the ON DECK pill with the next name big below and no set length", () => {
    const html = renderToStaticMarkup(createElement(TvTimerPanel, { name: "Karen Young", next: "Evan Hales", ms: 120000, totalMs: 180000, running: true }));
    expect(html).toContain(">On deck<");
    expect(html).toContain("text-7xl font-black");
    expect(html).toContain("Evan Hales");
    expect(html).not.toContain(" min<");
  });
});
