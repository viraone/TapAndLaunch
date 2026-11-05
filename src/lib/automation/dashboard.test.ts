import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  customerRecipients,
  decideSchedulingCaller,
  onceInstant,
  reminderScheduleChanged,
  schedulingSampleValues,
  shortTime,
} from "./dashboard";
import { renderAutomation } from "./render";
import { DEFAULT_SCHEDULING_AUTOMATION } from "./validate";

const APP = { name: "Jay's Cleaning" };
const SETTINGS = { time_zone: "America/Los_Angeles" };

describe("decideSchedulingCaller", () => {
  it("401s when nobody is signed in", () => {
    expect(
      decideSchedulingCaller({
        hasUser: false,
        isEditor: true,
        app: APP,
        settings: SETTINGS,
      })
    ).toEqual({ ok: false, status: 401, error: "Not authenticated" });
  });

  it("403s when the signed-in person is not an editor", () => {
    expect(
      decideSchedulingCaller({
        hasUser: true,
        isEditor: false,
        app: APP,
        settings: SETTINGS,
      })
    ).toEqual({ ok: false, status: 403, error: "Not authorized" });
  });

  it("404s when the app is not visible to them", () => {
    expect(
      decideSchedulingCaller({
        hasUser: true,
        isEditor: true,
        app: null,
        settings: SETTINGS,
      })
    ).toEqual({ ok: false, status: 404, error: "Not found" });
  });

  it("400s when Scheduling has not been turned on", () => {
    expect(
      decideSchedulingCaller({
        hasUser: true,
        isEditor: true,
        app: APP,
        settings: null,
      })
    ).toEqual({
      ok: false,
      status: 400,
      error: "Scheduling isn't turned on for this app yet.",
    });
  });

  it("passes the app's name and time zone through when everything is in place", () => {
    expect(
      decideSchedulingCaller({
        hasUser: true,
        isEditor: true,
        app: APP,
        settings: SETTINGS,
      })
    ).toEqual({
      ok: true,
      appName: "Jay's Cleaning",
      timeZone: "America/Los_Angeles",
    });
  });

  it("checks the refusals in order", () => {
    expect(
      decideSchedulingCaller({
        hasUser: false,
        isEditor: false,
        app: null,
        settings: null,
      })
    ).toMatchObject({ status: 401 });
    expect(
      decideSchedulingCaller({
        hasUser: true,
        isEditor: false,
        app: null,
        settings: null,
      })
    ).toMatchObject({ status: 403 });
    expect(
      decideSchedulingCaller({
        hasUser: true,
        isEditor: true,
        app: null,
        settings: null,
      })
    ).toMatchObject({ status: 404 });
  });
});

describe("shortTime", () => {
  it("cuts PostgREST's seconds down to the screen's HH:MM", () => {
    expect(shortTime("19:00:00")).toBe("19:00");
    expect(shortTime("09:05")).toBe("09:05");
  });
});

describe("onceInstant", () => {
  it("reads a real date and time in the reminder's zone", () => {
    expect(
      onceInstant({ once_date: "2026-11-06", send_time: "19:00" }, "UTC")?.toISOString()
    ).toBe("2026-11-06T19:00:00.000Z");
  });

  it("returns null for an unreadable date or time", () => {
    expect(onceInstant({ once_date: null, send_time: "19:00" }, "UTC")).toBeNull();
    expect(onceInstant({ once_date: "2026-02-30", send_time: "19:00" }, "UTC")).toBeNull();
    expect(onceInstant({ once_date: "2026-11-06", send_time: "7:00" }, "UTC")).toBeNull();
  });

  it("returns null for an unknown time zone", () => {
    expect(
      onceInstant({ once_date: "2026-11-06", send_time: "19:00" }, "Not/AZone")
    ).toBeNull();
  });
});

describe("reminderScheduleChanged", () => {
  const existing = {
    schedule_kind: "weekly" as const,
    weekday: 4,
    once_date: null,
    send_time: "19:00:00",
    time_zone: "America/Los_Angeles",
  };

  const input = {
    schedule_kind: "weekly" as const,
    weekday: 4,
    once_date: null,
    send_time: "19:00",
  };

  it("is false when only the wording or recipients change", () => {
    expect(
      reminderScheduleChanged(existing, input, "America/Los_Angeles")
    ).toBe(false);
  });

  it("treats HH:MM and HH:MM:SS as the same time", () => {
    expect(
      reminderScheduleChanged(existing, { ...input, send_time: "19:00:00" }, "America/Los_Angeles")
    ).toBe(false);
  });

  it.each([
    ["the kind", { ...input, schedule_kind: "once" as const, weekday: null }],
    ["the weekday", { ...input, weekday: 5 }],
    ["the date", { ...input, once_date: "2026-11-06" }],
    ["the time", { ...input, send_time: "20:00" }],
  ])("is true when %s changes", (_label, next) => {
    expect(reminderScheduleChanged(existing, next, "America/Los_Angeles")).toBe(true);
  });

  it("is true when the app's time zone changes", () => {
    expect(
      reminderScheduleChanged(existing, input, "America/New_York")
    ).toBe(true);
  });
});

describe("schedulingSampleValues", () => {
  const values = schedulingSampleValues(
    "Jay's Cleaning",
    new Date("2026-11-04T12:00:00Z"),
    "America/Los_Angeles"
  );

  it("uses the app's name as the business", () => {
    expect(values.business).toBe("Jay's Cleaning");
    expect(values.show_name).toBe("Jay's Cleaning");
  });

  it("uses a made-up recipient", () => {
    expect(values.first_name).toBe("Alex");
    expect(values.name).toBe("Alex Morgan");
  });

  it("renders the Scheduling default with the business name filled in", () => {
    const rendered = renderAutomation(DEFAULT_SCHEDULING_AUTOMATION, values);

    expect(rendered.subject).toBe("A note from Jay's Cleaning");
    expect(rendered.text).toBe("Hi Alex,\n\n\n\nThank you,\nJay's Cleaning");
  });
});

describe("customerRecipients", () => {
  it("keeps the customers that have an address, in the order given", () => {
    expect(
      customerRecipients([
        { id: "c1", name: "Alex Morgan", email: "alex@example.com" },
        { id: "c2", name: "No Email", email: null },
        { id: "c3", name: "Sam Lee", email: "sam@example.com" },
      ])
    ).toEqual([
      { id: "c1", name: "Alex Morgan", email: "alex@example.com" },
      { id: "c3", name: "Sam Lee", email: "sam@example.com" },
    ]);
  });

  it("drops a blank address and trims the ones it keeps", () => {
    expect(
      customerRecipients([
        { id: "c1", name: "Blank", email: "   " },
        { id: "c2", name: "Spaced", email: "  sam@example.com  " },
      ])
    ).toEqual([{ id: "c2", name: "Spaced", email: "sam@example.com" }]);
  });

  it("returns an empty list for no rows", () => {
    expect(customerRecipients([])).toEqual([]);
  });
});
