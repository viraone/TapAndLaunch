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

// Monday 28 Sept 2026, as StageTime dates a day (20:00 UTC).
const MONDAY = new Date("2026-09-28T20:00:00Z");

function mic(record: Record<string, unknown>): OpenMic {
  const normalized = normalizeOpenMicRecord(record);
  if (!normalized) throw new Error("test record did not normalize");
  return normalized;
}

function render(
  record: Record<string, unknown>,
  props: { isNext?: boolean; isActive?: boolean; isToday?: boolean; selectedDate?: Date; upcomingDate?: Date | null } = {}
) {
  return renderToStaticMarkup(
    createElement(ListingCard, {
      mic: mic(record),
      isNext: props.isNext ?? false,
      isActive: props.isActive ?? false,
      isToday: props.isToday ?? true,
      selectedDate: props.selectedDate ?? MONDAY,
      upcomingDate: props.upcomingDate ?? null,
    })
  );
}

describe("ListingCard", () => {
  it("shows every part of a full record, with the next-mic badges", () => {
    const html = render(LAUGHS, { isNext: true });
    for (const text of ["Next Open Mic", "Happening Today", "Laughs Open Mic", "7:30 PM", "The Rabbit Hole", "Start 7:30 PM",
      "123 Main St, Seattle, WA", "Comedy", "21+"]) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(/text-\[#00C805\][^"]*">Free</);
    expect(html).toMatch(/text-\[#00C805\]">7:30 PM</);
  });

  it("leaves out the next-mic badges, and a paid price isn't green", () => {
    const html = render({ ...LAUGHS, priceForTime: "$5" });
    expect(html).not.toContain("Next Open Mic");
    expect(html).not.toContain("Happening Today");
    expect(html).toContain(">$5<");
    expect(html).toMatch(/text-zinc-200">\$5</);
  });

  it("drops the venue when the name already says it", () => {
    const html = render({ ...LAUGHS, name: "Rabbit Hole Comedy Night", venue: "rabbit hole" });
    expect(html).not.toContain(">rabbit hole<");
  });

  it("says Time TBD and Time not listed when there is no time", () => {
    const html = render({ ...LAUGHS, timeSignupStart: "" });
    expect(html).toContain("Time TBD");
    expect(html).toContain("Time not listed");
  });

  it("gives Spice of Life its own time line", () => {
    expect(render({ ...LAUGHS, name: "Spice of Life Variety Open Mic" })).toContain("6:00 PM - Midnight");
  });

  it("confirms a non-weekly mic is on, today or on the chosen day", () => {
    const biweekly = { ...LAUGHS, recurrence: { type: "biweekly", weekday: "Tuesday", anchorDate: "2026-09-01" },
      recurrenceText: "Every Other Tuesday" };
    const tuesday = new Date("2026-09-29T20:00:00Z");
    expect(render(biweekly, { selectedDate: tuesday })).toContain("✓ Happening tonight!");
    expect(render(biweekly, { isToday: false, selectedDate: tuesday })).toContain("✓ Happening this Tuesday!");
    expect(render(biweekly, { selectedDate: tuesday })).toContain("Every Other Tuesday");
    expect(render(LAUGHS)).not.toContain("✓ Happening");
  });

  it("shows the details, the host, wheelchair access and the actions", () => {
    const html = render({
      ...LAUGHS,
      requirementsInfo: "Five-minute sets.",
      host: "Pat",
      wheelchairAccessible: true,
      webSignup: "https://example.com/signup",
      signupType: "online",
      signupDetails: "Sign up online by 6.",
      contact: "(206) 555-0100",
    });
    for (const text of ["Details &amp; Rules", "Five-minute sets.", "Host:", ">Pat<", "Wheelchair accessible",
      'href="https://example.com/signup"', ">Online Signup<", ">Signup details<", 'href="tel:+12065550100"', ">(206) 555-0100<"]) {
      expect(html).toContain(text);
    }
    expect(render({ ...LAUGHS, webSignup: "https://example.com" })).toContain(">Website / Signup<");
  });

  it("puts a scheduled host on the list button when there is a list", () => {
    const html = render({
      ...LAUGHS,
      host: "Anyone",
      hostSchedule: { "2026-09-28": "Erica" },
      listLabel: "October List",
      listUrl: "https://example.com/list",
    });
    expect(html).toContain('title="See October List"');
    expect(html).toContain(">Erica<");
    expect(html).not.toContain(">Anyone<");
    expect(html.match(/Host:/g)).toHaveLength(1);
  });

  it("shows a skipped week as a locked preview with the next date", () => {
    const html = render(LAUGHS, { isNext: true, upcomingDate: new Date("2026-10-13T20:00:00Z") });
    expect(html).toContain("Not happening tonight");
    expect(html).toContain("Next one: Oct 13 2026");
    expect(html).toContain("border-dashed");
    expect(html).not.toContain("Next Open Mic");
    expect(render(LAUGHS, { isToday: false, upcomingDate: new Date("2026-10-13T20:00:00Z") })).toContain(
      "Not happening this Monday"
    );
  });

  it("highlights only the active card", () => {
    expect(render(LAUGHS, { isActive: true })).toMatch(/cardActive/);
    expect(render(LAUGHS)).not.toMatch(/cardActive/);
  });
});
