import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineupList } from "./OpenMicSignupRuntime";
import type { LineupFeed } from "@/lib/openmic/selection";

const feed: LineupFeed = {
  show_date: "2026-11-13",
  posted: true,
  me: null,
  lineup: [
    { name: "Nick Cody", set_length: "5 min", start_time: "7:00 PM" },
    { name: "Karen", set_length: "3 min", start_time: "7:05 PM" },
    { name: "Bob", set_length: "3 min", start_time: "7:08 PM" },
  ],
};

const count = (html: string, text: string) => html.split(text).length - 1;
const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(LineupList, { feed, ...props }));

describe("LineupList host row", () => {
  it("shows Hosts on row 1 and On deck on row 2 when hostRow is true", () => {
    const html = render({ hostRow: true, onDeckIndex: 1 });
    expect(count(html, "Hosts")).toBe(1);
    expect(count(html, "On deck")).toBe(1);
    expect(html.indexOf("Hosts")).toBeLessThan(html.indexOf("On deck"));
  });
  it("does not show Hosts when hostRow is omitted", () => {
    const html = render({ onDeckIndex: 1 });
    expect(count(html, "Hosts")).toBe(0);
    expect(count(html, "On deck")).toBe(1);
  });
  it("does not show Hosts when row 1 is performing", () => {
    const html = render({ hostRow: true, performingIndex: 0, onDeckIndex: 1 });
    expect(count(html, "Hosts")).toBe(0);
    expect(count(html, "Live")).toBe(1);
  });
  it("shows Hosts and no On deck when onDeckIndex is absent", () => {
    const html = render({ hostRow: true });
    expect(count(html, "Hosts")).toBe(1);
    expect(count(html, "On deck")).toBe(0);
  });
});
