"use client";

import { useState } from "react";
import { EventBookRuntime, type RuntimeEvent } from "@/components/pwa-runtime/EventBookRuntime";
import {
  DEFAULT_CALENDAR_TIME_ZONE,
  addMonths,
  dayKey,
  groupByDay,
  monthGrid,
  monthLabel,
  monthOfKey,
  type CalendarDay,
} from "@/lib/calendar/month-grid";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Month = { year: number; month: number };

/** The month of the first listed event, or today's month when there are none. */
function initialMonth(events: RuntimeEvent[], timeZone: string, todayKey: string): Month {
  for (const event of events) {
    const key = dayKey(event.starts_at, timeZone);
    if (key !== null) return monthOfKey(key);
  }
  return monthOfKey(todayKey);
}

/** The first day of the grid's own month that has an event, in grid order. */
function firstEventDay(grid: CalendarDay[][], byDay: Record<string, RuntimeEvent[]>): string | null {
  for (const row of grid) {
    for (const cell of row) {
      if (cell.inMonth && (byDay[cell.key]?.length ?? 0) > 0) return cell.key;
    }
  }
  return null;
}

function firstDayInMonth(grid: CalendarDay[][]): string | null {
  for (const row of grid) {
    for (const cell of row) {
      if (cell.inMonth) return cell.key;
    }
  }
  return null;
}

function initialSelectedDay(events: RuntimeEvent[], timeZone: string, todayKey: string): string {
  const byDay = groupByDay(events, timeZone);
  if ((byDay[todayKey]?.length ?? 0) > 0) return todayKey;
  const month = initialMonth(events, timeZone, todayKey);
  return firstEventDay(monthGrid(month.year, month.month), byDay) ?? todayKey;
}

/** A month grid for an event_calendar block, with the selected day's events below it. The
 * server-rendered page and the first client render both start from `todayKey` (a prop) so the
 * markup matches exactly; no effect ever reads the visitor's clock. */
export function EventMonthView({
  events,
  todayKey,
  timeZone = DEFAULT_CALENDAR_TIME_ZONE,
}: {
  events: RuntimeEvent[];
  todayKey: string;
  timeZone?: string;
}) {
  const [cursor, setCursor] = useState<Month>(() => initialMonth(events, timeZone, todayKey));
  const [selectedDay, setSelectedDay] = useState<string>(() => initialSelectedDay(events, timeZone, todayKey));

  const byDay = groupByDay(events, timeZone);
  const grid = monthGrid(cursor.year, cursor.month);
  const label = monthLabel(cursor.year, cursor.month);
  const monthHasEvents = grid.some(
    (row) => row.some((cell) => cell.inMonth && (byDay[cell.key]?.length ?? 0) > 0)
  );
  const selectedEvents = byDay[selectedDay] ?? [];

  function showMonth(delta: number) {
    const next = addMonths(cursor.year, cursor.month, delta);
    const nextGrid = monthGrid(next.year, next.month);
    setCursor(next);
    setSelectedDay(firstEventDay(nextGrid, byDay) ?? firstDayInMonth(nextGrid) ?? selectedDay);
  }

  function pickDay(cell: CalendarDay) {
    setSelectedDay(cell.key);
    if (!cell.inMonth) setCursor(monthOfKey(cell.key));
  }

  return (
    <div className="rounded-md border p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => showMonth(-1)}
          className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
        >
          ‹
        </button>
        <p className="text-sm font-medium">{label}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => showMonth(1)}
          className="rounded-md border px-2 py-1 text-sm hover:bg-muted"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.flat().map((cell) => {
          const selected = cell.key === selectedDay;
          const hasEvents = (byDay[cell.key]?.length ?? 0) > 0;
          return (
            <button
              key={cell.key}
              type="button"
              data-day={cell.key}
              aria-pressed={selected}
              onClick={() => pickDay(cell)}
              className={[
                "flex h-9 flex-col items-center justify-center rounded-md text-sm",
                cell.inMonth ? "" : "text-muted-foreground/50",
                cell.key === todayKey ? "ring-1 ring-primary" : "",
                selected ? "bg-primary font-medium text-primary-foreground" : "hover:bg-muted",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span>{cell.day}</span>
              {hasEvents && <span data-event-dot="" className="mt-0.5 block h-1 w-1 rounded-full bg-current" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 space-y-2">
        {!monthHasEvents ? (
          <p className="text-sm text-muted-foreground">No events in {label}.</p>
        ) : selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events on this day.</p>
        ) : (
          selectedEvents.map((event) => <EventBookRuntime key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}
