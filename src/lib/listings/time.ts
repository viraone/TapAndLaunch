export const OPEN_MIC_CALENDAR_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type SeattleNow = {
  dayName: string;
  year: number;
  month: number;
  dayOfMonth: number;
  minutesSinceMidnight: number;
};

export function formatSeattleIsoDate(date: Date): string {
  const seattle = getSeattleNow(date);
  return `${seattle.year}-${String(seattle.month).padStart(2, "0")}-${String(seattle.dayOfMonth).padStart(2, "0")}`;
}

export function getSeattleNow(date: Date = new Date()): SeattleNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  // The live site reads the midnight hour as "24"; some runtimes report it as "0".
  const hour = Number(values.hour) === 0 ? 24 : Number(values.hour);
  return {
    dayName: values.weekday as string,
    year: Number(values.year),
    month: Number(values.month),
    dayOfMonth: Number(values.day),
    minutesSinceMidnight: hour * 60 + Number(values.minute),
  };
}

export function getWeekdayOccurrenceInMonth(dayOfMonth: number): number {
  return Math.floor((Number(dayOfMonth) - 1) / 7) + 1;
}

export function getNextSeattleWeekdayDate(
  dayName: string,
  date: Date = new Date()
): { date: Date; isToday: boolean } {
  const seattleNow = getSeattleNow(date);
  const currentDayIndex = OPEN_MIC_CALENDAR_DAYS.indexOf(seattleNow.dayName);
  const selectedDayIndex = OPEN_MIC_CALENDAR_DAYS.indexOf(dayName);
  const daysAhead = (selectedDayIndex - currentDayIndex + 7) % 7;
  return {
    date: new Date(
      Date.UTC(seattleNow.year, seattleNow.month - 1, seattleNow.dayOfMonth + daysAhead, 20)
    ),
    isToday: daysAhead === 0,
  };
}

export function formatSeattleCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
