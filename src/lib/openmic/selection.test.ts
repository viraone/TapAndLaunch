import { describe, expect, it } from "vitest";
import { CLOSED_NIGHT_COPY, notSelectedCopy, reopenPhrase, showDayState, slotLine, type LineupFeed } from "./selection";

const feed = (over: Partial<LineupFeed> = {}): LineupFeed => ({
  show_date: "2026-10-02",
  posted: true,
  lineup: [{ name: "Nick Cody", set_length: "5 min", start_time: "7:00 PM" }],
  me: { selected: false, set_length: "", start_time: "" },
  ...over,
});

describe("show-day state", () => {
  it("signed out sees just the lineup", () => {
    expect(showDayState({ signedIn: false, requested: false, feed: feed({ me: null }), failed: false, lineupTime: true })).toBe("signed-out");
  });
  it("signed in without a request this week", () => {
    expect(showDayState({ signedIn: true, requested: false, feed: feed(), failed: false, lineupTime: true })).toBe("no-request");
  });
  it("requested and selected", () => {
    expect(showDayState({ signedIn: true, requested: true, feed: feed({ me: { selected: true, set_length: "5 min", start_time: "7:00 PM" } }), failed: false, lineupTime: true })).toBe("selected");
  });
  it("requested, not selected, once selections are posted", () => {
    expect(showDayState({ signedIn: true, requested: true, feed: feed(), failed: false, lineupTime: true })).toBe("not-selected");
  });
  it("requested before any selections are posted: no verdict yet", () => {
    expect(showDayState({ signedIn: true, requested: true, feed: feed({ posted: false, lineup: [] }), failed: false, lineupTime: true })).toBe("selections-pending");
  });
  it("Thursday night: nothing about selections, even for a selected comic", () => {
    const selected = feed({ me: { selected: true, set_length: "5 min", start_time: "7:00 PM" } });
    expect(showDayState({ signedIn: true, requested: true, feed: selected, failed: false, lineupTime: false })).toBe("closed-night");
    expect(showDayState({ signedIn: true, requested: true, feed: null, failed: false, lineupTime: false })).toBe("closed-night");
  });
  it("Thursday night, signed in without a request: just the closed note", () => {
    expect(showDayState({ signedIn: true, requested: false, feed: null, failed: false, lineupTime: false })).toBe("no-request");
  });
  it("never claims 'not selected' when the lineup could not be loaded", () => {
    expect(showDayState({ signedIn: true, requested: true, feed: null, failed: true, lineupTime: true })).toBe("unavailable");
  });
  it("still loading: pending, not a verdict", () => {
    expect(showDayState({ signedIn: true, requested: true, feed: null, failed: false, lineupTime: true })).toBe("selections-pending");
  });
});

describe("copy", () => {
  it("not-selected message is the approved text on show day", () => {
    expect(notSelectedCopy(true)).toEqual({
      title: "Thanks for requesting a spot!",
      body: "We got a lot of requests for this Friday's show and couldn't fit everyone in. You're not on for this week, but we'd love to see you try again. Requests open tonight right after the show.",
    });
  });
  it("on Thursday night it says tomorrow's show, not tonight", () => {
    expect(notSelectedCopy(false).body).toMatch(/Requests open right after tomorrow's show\.$/);
    expect(reopenPhrase(false)).not.toMatch(/tonight/);
  });
  it("never uses the old words", () => {
    for (const day of [true, false]) expect(JSON.stringify(notSelectedCopy(day))).not.toMatch(/standby|pick/i);
  });
  it("the Thursday-night note points to Friday morning", () => {
    expect(CLOSED_NIGHT_COPY.body).toBe("If you're selected, we'll email you. Check this page Friday morning.");
    expect(JSON.stringify(CLOSED_NIGHT_COPY)).not.toMatch(/standby|pick/i);
  });
  it("slot line skips blanks", () => {
    expect(slotLine({ start_time: "7:00 PM", set_length: "5 min" })).toBe("7:00 PM · 5 min");
    expect(slotLine({ start_time: "", set_length: "" })).toBe("");
  });
});
