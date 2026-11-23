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
    { name: "Dennis AK", set_length: "3 min", start_time: "7:00 PM" },
    { name: "Karen", set_length: "3 min", start_time: "7:05 PM" },
  ],
};

const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(LineupList, { feed, ...props }));

describe("LineupList tap", () => {
  it("with onTap and canTap, only the matching row is tappable", () => {
    const html = render({ onTap: () => {}, canTap: (e: { name: string }) => e.name === "Dennis AK" });
    expect(html.match(/role="button"/g)?.length).toBe(1);
    expect(html.match(/lucide-message-circle/g)?.length).toBe(1);
  });
  it("with onTap and no canTap, every row is tappable", () => {
    const html = render({ onTap: () => {} });
    expect(html.match(/role="button"/g)?.length).toBe(2);
  });
  it("with no onTap, no row is tappable", () => {
    const html = render({});
    expect(html).not.toContain('role="button"');
  });
});
