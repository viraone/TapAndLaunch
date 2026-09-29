import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingDirectoryView } from "@/components/pwa-runtime/ListingDirectoryView";
import { buildOpenMicDay, type OpenMicTypeFilter } from "@/lib/listings/day";
import { normalizeOpenMicRecord, type OpenMic } from "@/lib/listings/record";

const NO_DAYS = { monday: "no", tuesday: "no", wednesday: "no", thursday: "no", friday: "no", saturday: "no", sunday: "no" };
const EARLY = { ...NO_DAYS, id: "early", name: "Early Mic", timeSignupStart: "6pm/7pm", monday: "Yes" };
const LATE = { ...NO_DAYS, id: "late", name: "Late Mic", timeSignupStart: "9pm", monday: "Yes" };

// Monday 28 Sept 2026 at noon in Seattle (PDT is UTC-7).
const MONDAY_NOON = new Date("2026-09-28T19:00:00Z");

function render(
  records: Record<string, unknown>[],
  { day = null, type = "all", activeId }: { day?: string | null; type?: OpenMicTypeFilter; activeId?: string | null } = {}
) {
  const mics = records.map((r) => normalizeOpenMicRecord(r)).filter((m): m is OpenMic => m !== null);
  const openMicDay = buildOpenMicDay(mics, MONDAY_NOON, day, type);
  return renderToStaticMarkup(
    createElement(ListingDirectoryView, {
      day: openMicDay,
      selectedType: type,
      activeId: activeId === undefined ? (openMicDay.nextMic?.id ?? null) : activeId,
    })
  );
}

/** The card (article) that holds this mic's name. */
function cardFor(html: string, name: string): string {
  const card = html.split("<article").find((part) => part.includes(`>${name}<`));
  if (!card) throw new Error(`no card for ${name}`);
  return card;
}

describe("ListingDirectoryView", () => {
  it("shows StageTime's header, the day and type buttons, and the location line", () => {
    const html = render([EARLY]);
    for (const text of ["Open Mics Today", "<span>Monday</span>", "September 28, 2026", "Show Distance",
      "Turn on location to see distance and drive times.", "OpenStreetMap contributors", ">All<", ">Comedy<",
      ">Music &amp; Variety<"]) {
      expect(html).toContain(text);
    }
    for (const label of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(html).toContain(`>${label}</button>`);
    }
    expect(html).toMatch(/aria-pressed="true"[^>]*>Mon</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>All</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Tue</);
  });

  it("shows the cards in time order with the next one badged and highlighted", () => {
    const html = render([LATE, EARLY]);
    expect(html.indexOf("Early Mic")).toBeLessThan(html.indexOf("Late Mic"));
    expect(cardFor(html, "Early Mic")).toContain("Next Open Mic");
    expect(cardFor(html, "Early Mic")).toMatch(/cardActive/);
    expect(cardFor(html, "Late Mic")).not.toMatch(/cardActive/);
  });

  it("moves the highlight, not the Next badge, to a chosen mic", () => {
    const html = render([LATE, EARLY], { activeId: "late" });
    expect(cardFor(html, "Late Mic")).toMatch(/cardActive/);
    expect(cardFor(html, "Early Mic")).not.toMatch(/cardActive/);
    expect(cardFor(html, "Early Mic")).toContain("Next Open Mic");
  });

  it("sums up the selected day: count, next, last, and a line per mic", () => {
    const html = render([LATE, EARLY]);
    expect(html).toContain("Monday&#x27;s Mics");
    expect(html).toContain(">2 open mics<");
    expect(html).toContain("7:00 PM · Early Mic");
    expect(html).toContain("9:00 PM · Late Mic");
    expect(render([EARLY])).toContain(">1 open mic<");
  });

  it("says so, with dashes in the summary, when nothing is on", () => {
    const html = render([EARLY], { day: "Wednesday" });
    expect(html).toContain("<span>Wednesday</span>");
    expect(html).toContain("No open mics listed for this day.");
    expect(html).toContain(">0 open mics<");
    expect(html).toContain(">—</dd>");
    expect(html).not.toContain("<article");
  });
});
