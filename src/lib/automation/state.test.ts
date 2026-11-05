import { describe, expect, it } from "vitest";
import { reminderState, type ReminderRow, type SendLogRow } from "./state";

const NOW = new Date("2026-11-04T20:00:00.000Z"); // Wednesday afternoon in Los Angeles.

function weekly(overrides: Partial<ReminderRow> = {}): ReminderRow {
  return {
    id: "reminder_1",
    name: "Thursday reminder",
    enabled: true,
    schedule_kind: "weekly",
    weekday: 4,
    once_date: null,
    send_time: "19:00:00",
    time_zone: "America/Los_Angeles",
    subject: "See you tomorrow",
    body: "Hey {first_name}",
    ...overrides,
  };
}

describe("reminderState", () => {
  it("carries the saved fields, the recipients and the next send", () => {
    const state = reminderState(
      weekly(),
      [{ name: "Alex Morgan", email: "alex@example.com" }],
      [],
      NOW
    );

    expect(state.id).toBe("reminder_1");
    expect(state.schedule_kind).toBe("weekly");
    expect(state.weekday).toBe(4);
    expect(state.recipients).toEqual([{ name: "Alex Morgan", email: "alex@example.com" }]);
    expect(state.recent).toEqual([]);
    // Thursday 19:00 in Los Angeles is Friday 03:00 UTC while standard time holds.
    expect(state.nextSendAt).toBe("2026-11-06T03:00:00.000Z");
  });

  it("has no next send for a one-off reminder whose moment has passed", () => {
    const state = reminderState(
      weekly({ schedule_kind: "once", weekday: null, once_date: "2026-11-01" }),
      [],
      [],
      NOW
    );

    expect(state.nextSendAt).toBeNull();
  });

  it("summarises the five newest occurrences, newest first, with their status counts", () => {
    const log: SendLogRow[] = [
      { occurrence_at: "2026-11-01T02:00:00+00:00", status: "sent" },
      { occurrence_at: "2026-11-01T02:00:00+00:00", status: "failed" },
      { occurrence_at: "2026-10-25T02:00:00+00:00", status: "sent" },
      { occurrence_at: "2026-10-18T02:00:00+00:00", status: "sending" },
      { occurrence_at: "2026-10-11T02:00:00+00:00", status: "sent" },
      { occurrence_at: "2026-10-04T02:00:00+00:00", status: "sent" },
      // A sixth occurrence must not make the list.
      { occurrence_at: "2026-09-27T02:00:00+00:00", status: "sent" },
    ];

    const state = reminderState(weekly(), [], log, NOW);

    expect(state.recent).toEqual([
      { occurrence_at: "2026-11-01T02:00:00+00:00", sent: 1, failed: 1, sending: 0 },
      { occurrence_at: "2026-10-25T02:00:00+00:00", sent: 1, failed: 0, sending: 0 },
      { occurrence_at: "2026-10-18T02:00:00+00:00", sent: 0, failed: 0, sending: 1 },
      { occurrence_at: "2026-10-11T02:00:00+00:00", sent: 1, failed: 0, sending: 0 },
      { occurrence_at: "2026-10-04T02:00:00+00:00", sent: 1, failed: 0, sending: 0 },
    ]);
  });
});
