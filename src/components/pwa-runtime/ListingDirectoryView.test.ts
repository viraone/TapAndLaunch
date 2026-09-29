import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingDirectoryView } from "@/components/pwa-runtime/ListingDirectoryView";

const NO_DAYS = { monday: "no", tuesday: "no", wednesday: "no", thursday: "no", friday: "no", saturday: "no", sunday: "no" };
const EARLY = { ...NO_DAYS, id: "early", name: "Early Mic", timeSignupStart: "6pm/7pm", monday: "Yes" };
const LATE = { ...NO_DAYS, id: "late", name: "Late Mic", timeSignupStart: "9pm", monday: "Yes" };
const TUESDAY = { ...NO_DAYS, id: "tuesday", name: "Tuesday Mic", timeSignupStart: "8pm", tuesday: "Yes" };
const EVERY_OTHER = { ...NO_DAYS, id: "every-other", name: "Every Other Mic", timeSignupStart: "8pm",
  recurrence: { type: "biweekly", weekday: "Monday", anchorDate: "2026-09-28" }, recurrenceText: "Every Other Monday" };

// Monday 28 Sept 2026 in Seattle (PDT is UTC-7).
const MONDAY_NOON = new Date("2026-09-28T19:00:00Z");
const MONDAY_9_30_PM = new Date("2026-09-29T04:30:00Z");
const MONDAY_11_30_PM = new Date("2026-09-29T06:30:00Z");

function render(records: Record<string, unknown>[], now: Date) {
  const listings = records.map((record, i) => ({ slug: `s${i}`, record }));
  return renderToStaticMarkup(createElement(ListingDirectoryView, { listings, now }));
}

/** The card (article) that holds this mic's name. */
function cardFor(html: string, name: string): string {
  const card = html.split("<article").find((part) => part.includes(`>${name}<`));
  if (!card) throw new Error(`no card for ${name}`);
  return card;
}

describe("ListingDirectoryView", () => {
  it("shows the header and today's mics in start-time order, with the next one badged", () => {
    const html = render([LATE, TUESDAY, EARLY], MONDAY_NOON);
    for (const text of ["Open Mics Today", ">Monday<", "September 28, 2026"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("Tuesday Mic");
    expect(html.indexOf("Early Mic")).toBeLessThan(html.indexOf("Late Mic"));
    expect(cardFor(html, "Early Mic")).toContain("Next Open Mic");
    expect(cardFor(html, "Late Mic")).not.toContain("Next Open Mic");
  });

  it("moves the Next badge to the mic that has most recently started", () => {
    const html = render([EARLY, LATE], MONDAY_9_30_PM);
    expect(cardFor(html, "Late Mic")).toContain("Next Open Mic");
    expect(cardFor(html, "Early Mic")).not.toContain("Next Open Mic");
  });

  it("uses Seattle's day, not UTC's, late in the evening", () => {
    const html = render([EARLY, TUESDAY], MONDAY_11_30_PM);
    expect(html).toContain(">Monday<");
    expect(html).toContain("Early Mic");
    expect(html).not.toContain("Tuesday Mic");
  });

  it("says so when no mic is on today", () => {
    const html = render([EARLY, LATE], new Date("2026-09-30T19:00:00Z"));
    expect(html).toContain(">Wednesday<");
    expect(html).toContain("No open mics listed for today.");
    expect(html).not.toContain("<article");
  });

  it("shows an every-other-week mic only on its weeks", () => {
    const onItsWeek = render([EVERY_OTHER], MONDAY_NOON);
    expect(onItsWeek).toContain("Every Other Mic");
    expect(onItsWeek).toContain("✓ Happening tonight!");
    expect(render([EVERY_OTHER], new Date("2026-10-05T19:00:00Z"))).toContain("No open mics listed for today.");
  });

  it("skips a record that has no name", () => {
    const html = render([{ ...EARLY, name: "" }, LATE], MONDAY_NOON);
    expect(html.split("<article").length - 1).toBe(1);
    expect(html).toContain("Late Mic");
  });
});
