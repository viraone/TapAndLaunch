import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingCard } from "@/components/pwa-runtime/ListingCard";
import { normalizeOpenMicRecord, type OpenMic } from "@/lib/listings/record";

const LAUGHS = {
  id: "laughs",
  name: "Laughs Open Mic",
  venue: "The Rabbit Hole",
  location: "123 Main St, Seattle, WA",
  timeSignupStart: "7pm/7:30pm",
  priceForTime: "Free",
  openMicType: "Comedy",
  ageRequirement: "21+",
};

function mic(record: Record<string, unknown>): OpenMic {
  const normalized = normalizeOpenMicRecord(record);
  if (!normalized) throw new Error("test record did not normalize");
  return normalized;
}

function render(record: Record<string, unknown>, isNext: boolean, isToday = true, dayName = "Monday") {
  return renderToStaticMarkup(createElement(ListingCard, { mic: mic(record), isNext, isToday, dayName }));
}

describe("ListingCard", () => {
  it("shows every part of a full record, with the next-mic badges", () => {
    const html = render(LAUGHS, true);
    for (const text of ["Next Open Mic", "Happening Today", "Laughs Open Mic", "7:30 PM", "The Rabbit Hole", "Start 7:30 PM",
      "123 Main St, Seattle, WA", "Comedy", "21+"]) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(/text-green-700[^"]*">Free</);
  });

  it("leaves out the next-mic badges, and a paid price isn't green", () => {
    const html = render({ ...LAUGHS, priceForTime: "$5" }, false);
    expect(html).not.toContain("Next Open Mic");
    expect(html).not.toContain("Happening Today");
    expect(html).toContain(">$5<");
    expect(html).not.toMatch(/text-green-700[^"]*">\$5</);
  });

  it("drops the venue when the name already says it", () => {
    const html = render({ ...LAUGHS, name: "Rabbit Hole Comedy Night", venue: "rabbit hole" }, false);
    expect(html).not.toContain(">rabbit hole<");
  });

  it("says Time TBD and Time not listed when there is no time", () => {
    const html = render({ ...LAUGHS, timeSignupStart: "" }, false);
    expect(html).toContain("Time TBD");
    expect(html).toContain("Time not listed");
  });

  it("gives Spice of Life its own time line", () => {
    expect(render({ ...LAUGHS, name: "Spice of Life Variety Open Mic" }, false)).toContain("6:00 PM - Midnight");
  });

  it("confirms a non-weekly mic is on, today or on the chosen day", () => {
    const biweekly = { ...LAUGHS, recurrence: { type: "biweekly", weekday: "Tuesday", anchorDate: "2026-09-01" },
      recurrenceText: "Every Other Tuesday" };
    expect(render(biweekly, false)).toContain("✓ Happening tonight!");
    expect(render(biweekly, false, false, "Tuesday")).toContain("✓ Happening this Tuesday!");
    expect(render(biweekly, false)).toContain("Every Other Tuesday");
    expect(render(LAUGHS, false)).not.toContain("✓ Happening");
  });
});
