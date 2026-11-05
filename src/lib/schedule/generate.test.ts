import { describe, expect, it } from "vitest";
import type { ScheduleSeriesRow } from "@/types/database";
import { visitRowsForSeries } from "./generate";

const LOS_ANGELES = "America/Los_Angeles";

function series(overrides: Partial<ScheduleSeriesRow> = {}): ScheduleSeriesRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    app_id: "22222222-2222-2222-2222-222222222222",
    customer_id: "33333333-3333-3333-3333-333333333333",
    starts_on: "2026-10-20",
    start_time: "10:00:00",
    duration_minutes: 90,
    interval_weeks: 1,
    ends_on: null,
    service: "Deep clean",
    notes: "Use the side door",
    active: true,
    created_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("visitRowsForSeries", () => {
  it("gives a weekly rule the right dates and occurrence_on values", () => {
    const rows = visitRowsForSeries(
      series(),
      "2026-10-20",
      "2026-11-10",
      LOS_ANGELES
    );

    expect(rows.map((row) => row.starts_at)).toEqual([
      "2026-10-20T17:00:00.000Z",
      "2026-10-27T17:00:00.000Z",
      "2026-11-03T18:00:00.000Z",
      "2026-11-10T18:00:00.000Z",
    ]);
    expect(rows.map((row) => row.occurrence_on)).toEqual([
      "2026-10-20",
      "2026-10-27",
      "2026-11-03",
      "2026-11-10",
    ]);
  });

  it("returns no rows for an inactive rule", () => {
    expect(
      visitRowsForSeries(
        series({ active: false }),
        "2026-10-20",
        "2026-11-10",
        LOS_ANGELES
      )
    ).toEqual([]);
  });

  it("respects the rule's ends_on date", () => {
    const rows = visitRowsForSeries(
      series({ ends_on: "2026-11-03" }),
      "2026-10-01",
      "2026-12-31",
      LOS_ANGELES
    );

    expect(rows.map((row) => row.occurrence_on)).toEqual([
      "2026-10-20",
      "2026-10-27",
      "2026-11-03",
    ]);
  });

  it("copies the rule's fields onto every row", () => {
    const rule = series();
    const [row] = visitRowsForSeries(
      rule,
      "2026-10-20",
      "2026-10-20",
      LOS_ANGELES
    );

    expect(row).toMatchObject({
      app_id: rule.app_id,
      customer_id: rule.customer_id,
      series_id: rule.id,
      starts_at: "2026-10-20T17:00:00.000Z",
      occurrence_on: "2026-10-20",
      duration_minutes: 90,
      service: "Deep clean",
      notes: "Use the side door",
      status: "scheduled",
    });
  });
});
