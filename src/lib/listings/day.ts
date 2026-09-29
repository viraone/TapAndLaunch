import { classifyOpenMicCategory } from "./parse";
import type { OpenMic } from "./record";
import { getNextOpenMicOccurrenceDate, openMicOccursOnSeattleDate } from "./recurrence";
import { selectOpenMicsForSeattleDate } from "./select";
import { formatSeattleCalendarDate, getNextSeattleWeekdayDate, getSeattleNow } from "./time";

export type OpenMicTypeFilter = "all" | "comedy" | "variety";

export function filterOpenMicsByType(mics: OpenMic[], selectedType: OpenMicTypeFilter): OpenMic[] {
  if (selectedType === "all") return mics;
  return mics.filter((mic) => classifyOpenMicCategory(mic.micType) === selectedType);
}

/** One card in the list: a mic on the selected day, or (with `upcomingDate`)
 * a mic whose schedule skips that day, shown locked with its next date. */
export type OpenMicDayCard = { mic: OpenMic; upcomingDate: Date | null; isNext: boolean };

export type OpenMicDay = {
  dayName: string;
  /** "September 28, 2026". */
  dateLabel: string;
  isToday: boolean;
  /** The selected day at 20:00 UTC, as StageTime dates it. */
  selectedDate: Date;
  todays: OpenMic[];
  nextMic: OpenMic | null;
  lastMic: OpenMic | null;
  cards: OpenMicDayCard[];
  /** The line above the list when there is nothing (more) to show. */
  status: string | null;
};

const byStartThenName = (a: OpenMic, b: OpenMic): number => {
  const timeA = a.startMinutes ?? a.signupMinutes ?? 9999;
  const timeB = b.startMinutes ?? b.signupMinutes ?? 9999;
  if (timeA !== timeB) return timeA - timeB;
  return a.name.localeCompare(b.name);
};

/** What StageTime's open mic view shows for one day (renderOpenMicMapView in
 * its app.js). `selectedDayName` null means today in Seattle. */
export function buildOpenMicDay(
  allMics: OpenMic[],
  now: Date,
  selectedDayName: string | null,
  selectedType: OpenMicTypeFilter
): OpenMicDay {
  const selected = getNextSeattleWeekdayDate(selectedDayName ?? getSeattleNow(now).dayName, now);
  const mics = filterOpenMicsByType(allMics, selectedType);
  const { dayName, todays, nextMic, lastMic } = selectOpenMicsForSeattleDate(
    mics,
    selected.isToday ? now : selected.date,
    selected.isToday
  );

  const selectedSeattleDate = getSeattleNow(selected.date);
  const upcomingPreviews = mics
    .filter(
      (mic) =>
        mic.showWhenInactive &&
        String(mic.recurrence?.weekday || "").toLowerCase() === dayName.toLowerCase() &&
        !openMicOccursOnSeattleDate(mic, selectedSeattleDate)
    )
    .map((mic) => ({ mic, date: getNextOpenMicOccurrenceDate(mic, selected.date) }))
    .filter((preview): preview is { mic: OpenMic; date: Date } => preview.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let status: string | null = null;
  if (todays.length === 0 && upcomingPreviews.length === 0) {
    const dayPhrase = selected.isToday ? "today" : "this day";
    status =
      selectedType === "all"
        ? `No open mics listed for ${dayPhrase}.`
        : `No matching open mics for ${dayPhrase}. Try clearing the type filter.`;
  } else if (selected.isToday && !nextMic) {
    status = "No more open mics scheduled for today.";
  }

  // Every card in start-time order, the locked monthly previews included.
  const cards = [
    ...todays.map((mic) => ({ mic, upcomingDate: null })),
    ...upcomingPreviews.map(({ mic, date }) => ({ mic, upcomingDate: date })),
  ]
    .sort((a, b) => byStartThenName(a.mic, b.mic))
    .map((card) => ({ ...card, isNext: nextMic !== null && card.mic.id === nextMic.id }));

  return {
    dayName,
    dateLabel: formatSeattleCalendarDate(selected.date),
    isToday: selected.isToday,
    selectedDate: selected.date,
    todays,
    nextMic,
    lastMic,
    cards: todays.length === 0 && upcomingPreviews.length === 0 ? [] : cards,
    status,
  };
}
