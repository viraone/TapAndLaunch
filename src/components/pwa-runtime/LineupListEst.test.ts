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

describe("LineupList Est. label", () => {
  it("labels every comic's time before the show, but not the hosts row", () => {
    const html = render({ hostRow: true, onDeckIndex: 1 });
    expect(count(html, "Est.")).toBe(2);
    expect(html).toContain("7:00 PM");
  });
  it("labels every row when there is no hosts row", () => {
    expect(count(render({}), "Est.")).toBe(3);
  });
  it("keeps the label only on comics still waiting once the show runs, and drops the ~", () => {
    const startLabels = [
      { text: "7:00 PM", estimated: false },
      { text: "7:06 PM", estimated: false },
      { text: "~7:09 PM", estimated: true },
    ];
    const html = render({ hostRow: true, performingIndex: 1, onDeckIndex: 2, startLabels, finished: [null, null, null] });
    expect(count(html, "Est.")).toBe(1);
    expect(html).toContain("7:09 PM");
    expect(html).not.toContain("~7:09 PM");
  });
  it("shows no label on a finished row or the live row", () => {
    const html = render({ hostRow: true, performingIndex: 2, finished: [null, "2:50", null] });
    expect(count(html, "Est.")).toBe(0);
  });
});
