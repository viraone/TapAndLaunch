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
    { name: "Sam", set_length: "7 min", start_time: "7:11 PM" },
  ],
};

const count = (html: string, part: string) => html.split(part).length - 1;
const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(LineupList, { feed, ...props }));

describe("LineupList set-length pills", () => {
  it("draws the common set length quieter and a different length brighter", () => {
    const html = render({});
    expect(count(html, "text-muted-foreground/60 ring-white/5")).toBe(2);
    expect(count(html, "text-foreground ring-white/20")).toBe(2);
  });
});

