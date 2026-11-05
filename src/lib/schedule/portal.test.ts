import { describe, expect, it } from "vitest";
import {
  automationTileStatus,
  customersTileStatus,
  moreThisWeekLine,
  remindersTileStatus,
  scheduleTileStatus,
  setupSteps,
  todayHeaderLine,
  visitLengthLabel,
} from "./portal";

describe("visitLengthLabel", () => {
  it("keeps visits under an hour in minutes", () => {
    expect(visitLengthLabel(45)).toBe("45 min");
    expect(visitLengthLabel(30)).toBe("30 min");
  });

  it("writes whole hours without decimals", () => {
    expect(visitLengthLabel(60)).toBe("1 h");
    expect(visitLengthLabel(120)).toBe("2 h");
  });

  it("writes half hours and quarter hours", () => {
    expect(visitLengthLabel(90)).toBe("1.5 h");
    expect(visitLengthLabel(75)).toBe("1.25 h");
  });
});

describe("todayHeaderLine", () => {
  it("names the weekday, month and day and counts today's visits", () => {
    expect(todayHeaderLine("2026-11-04", 3)).toBe("Wednesday, Nov 4 · 3 visits today");
  });

  it("says one visit in the singular", () => {
    expect(todayHeaderLine("2026-11-04", 1)).toBe("Wednesday, Nov 4 · 1 visit today");
  });

  it("says no visits today rather than zero", () => {
    expect(todayHeaderLine("2026-11-04", 0)).toBe("Wednesday, Nov 4 · No visits today");
  });

  it("reads the date itself, not the machine's clock", () => {
    expect(todayHeaderLine("2026-01-01", 2)).toBe("Thursday, Jan 1 · 2 visits today");
    expect(todayHeaderLine("2026-11-08", 0)).toBe("Sunday, Nov 8 · No visits today");
  });
});

describe("moreThisWeekLine", () => {
  it("says nothing else this week when the rest of the week is free", () => {
    expect(moreThisWeekLine(0)).toBe("Nothing else this week");
  });

  it("says one more visit in the singular", () => {
    expect(moreThisWeekLine(1)).toBe("1 more visit this week");
  });

  it("counts the rest of the week", () => {
    expect(moreThisWeekLine(4)).toBe("4 more visits this week");
  });
});

describe("scheduleTileStatus", () => {
  it("counts this week", () => {
    expect(scheduleTileStatus(6)).toBe("6 this week");
    expect(scheduleTileStatus(1)).toBe("1 this week");
  });

  it("says nothing this week when the week is free", () => {
    expect(scheduleTileStatus(0)).toBe("Nothing this week");
  });
});

describe("customersTileStatus", () => {
  it("counts people", () => {
    expect(customersTileStatus(24)).toBe("24 people");
  });

  it("says one person in the singular", () => {
    expect(customersTileStatus(1)).toBe("1 person");
  });

  it("says there are no customers yet", () => {
    expect(customersTileStatus(0)).toBe("No customers yet");
  });
});

describe("remindersTileStatus", () => {
  const connected = { connected: true, needsReconnect: false, enabled: false, hoursBefore: null };

  it("asks to connect when there is no Gmail account", () => {
    expect(remindersTileStatus({ ...connected, connected: false })).toBe("Connect Gmail");
  });

  it("asks to reconnect when Google no longer accepts the grant", () => {
    expect(remindersTileStatus({ ...connected, needsReconnect: true, enabled: true, hoursBefore: 24 })).toBe(
      "Reconnect Gmail"
    );
  });

  it("turns hours into days", () => {
    expect(remindersTileStatus({ ...connected, enabled: true, hoursBefore: 24 })).toBe("On · 1 day before");
    expect(remindersTileStatus({ ...connected, enabled: true, hoursBefore: 48 })).toBe("On · 2 days before");
    expect(remindersTileStatus({ ...connected, enabled: true, hoursBefore: 72 })).toBe("On · 3 days before");
  });

  it("keeps short leads in hours", () => {
    expect(remindersTileStatus({ ...connected, enabled: true, hoursBefore: 1 })).toBe("On · 1 hour before");
    expect(remindersTileStatus({ ...connected, enabled: true, hoursBefore: 2 })).toBe("On · 2 hours before");
    expect(remindersTileStatus({ ...connected, enabled: true, hoursBefore: 4 })).toBe("On · 4 hours before");
    expect(remindersTileStatus({ ...connected, enabled: true, hoursBefore: 12 })).toBe("On · 12 hours before");
  });

  it("is Off when automatic reminders are off or none is saved", () => {
    expect(remindersTileStatus({ ...connected, enabled: false, hoursBefore: 24 })).toBe("Off");
    expect(remindersTileStatus({ ...connected, enabled: true, hoursBefore: null })).toBe("Off");
  });
});

describe("automationTileStatus", () => {
  it("counts the messages that are on", () => {
    expect(automationTileStatus(2)).toBe("2 messages on");
  });

  it("says one message in the singular", () => {
    expect(automationTileStatus(1)).toBe("1 message on");
  });

  it("says nothing is scheduled when none are on", () => {
    expect(automationTileStatus(0)).toBe("Nothing scheduled");
  });
});

describe("setupSteps", () => {
  it("lists the three steps in order", () => {
    const setup = setupSteps({ customers: 0, anyVisit: false, gmailReady: false });
    expect(setup.steps.map((step) => step.label)).toEqual(["Add a customer", "Add a visit", "Connect Gmail"]);
    expect(setup.steps.map((step) => step.path)).toEqual(["customers", "schedule", "reminders"]);
    expect(setup.steps.map((step) => step.done)).toEqual([false, false, false]);
    expect(setup.nextIndex).toBe(0);
    expect(setup.doneCount).toBe(0);
  });

  it("moves the next step on as each one is done", () => {
    const one = setupSteps({ customers: 1, anyVisit: false, gmailReady: false });
    expect(one.doneCount).toBe(1);
    expect(one.nextIndex).toBe(1);

    const two = setupSteps({ customers: 1, anyVisit: true, gmailReady: false });
    expect(two.doneCount).toBe(2);
    expect(two.nextIndex).toBe(2);
  });

  it("has no next step when all three are done", () => {
    const setup = setupSteps({ customers: 1, anyVisit: true, gmailReady: true });
    expect(setup.doneCount).toBe(3);
    expect(setup.nextIndex).toBeNull();
  });

  it("points at the first undone step even when a later one is done", () => {
    const setup = setupSteps({ customers: 0, anyVisit: false, gmailReady: true });
    expect(setup.doneCount).toBe(1);
    expect(setup.nextIndex).toBe(0);
  });
});
