import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));

import { EventMonthView } from "@/components/pwa-runtime/EventMonthView";
import type { RuntimeEvent } from "@/components/pwa-runtime/EventBookRuntime";

function makeEvent(id: string, title: string, startsAt: string): RuntimeEvent {
  return {
    id,
    title,
    description: null,
    location: null,
    starts_at: startsAt,
    ends_at: null,
    capacity: null,
    bookedCount: 0,
  };
}

function render(events: RuntimeEvent[], todayKey: string, timeZone?: string) {
  return renderToStaticMarkup(
    createElement(EventMonthView, { events, todayKey, ...(timeZone !== undefined ? { timeZone } : {}) })
  );
}

describe("EventMonthView", () => {
  it("draws a five-week November with a dot on each event day and the selected day's events", () => {
    const events = [
      makeEvent("a", "Early Show", "2026-11-06T19:00:00-08:00"),
      makeEvent("b", "Late Show", "2026-11-06T21:30:00-08:00"),
      makeEvent("c", "Third Friday", "2026-11-20T20:00:00-08:00"),
    ];
    const html = render(events, "2026-11-06");

    expect(html).toContain("November 2026");
    expect(html.match(/data-day=/g)).toHaveLength(35);
    expect(html.match(/data-event-dot/g)).toHaveLength(2);
    expect(html).toContain("Early Show");
    expect(html).toContain("Late Show");
    expect(html).not.toContain("Third Friday");
  });

  it("says the month has no events when there are none at all", () => {
    const html = render([], "2026-11-06");

    expect(html).toContain("November 2026");
    expect(html).toContain("No events in November 2026.");
    expect(html).not.toContain("data-event-dot");
  });

  it("opens the first event's month when today's month has no events", () => {
    const html = render([makeEvent("c", "Third Friday", "2026-11-20T20:00:00-08:00")], "2026-10-06");

    expect(html).toContain("November 2026");
    expect(html).not.toContain("October 2026");
    expect(html).toContain("Third Friday");
  });
});
