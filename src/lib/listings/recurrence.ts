import { getSeattleNow, getWeekdayOccurrenceInMonth } from "./time";
import type { SeattleNow } from "./time";
import type { OpenMic } from "./record";

type RecurrenceMic = Pick<OpenMic, "recurrence" | "days" | "anchorDate">;

export function openMicOccursOnSeattleDate(mic: RecurrenceMic, seattleNow: SeattleNow): boolean {
  const recurrence = mic.recurrence as Record<string, unknown> | null;
  if (!recurrence) return Boolean(mic.days[seattleNow.dayName]);

  const dateKey = `${seattleNow.year}-${String(seattleNow.month).padStart(2, "0")}-${String(seattleNow.dayOfMonth).padStart(2, "0")}`;
  const startDate = String(recurrence.startDate || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && dateKey < startDate) return false;

  if (Array.isArray(recurrence.additionalDates) && recurrence.additionalDates.includes(dateKey)) {
    return true;
  }

  const recurrenceWeekdayMatches = String(recurrence.weekday || "").toLowerCase() === seattleNow.dayName.toLowerCase();

  if (recurrence.type === "weekly") {
    return Boolean(mic.days[seattleNow.dayName]) || recurrenceWeekdayMatches;
  }

  if (!recurrenceWeekdayMatches) return false;

  const occurrence = getWeekdayOccurrenceInMonth(seattleNow.dayOfMonth);
  const daysInMonth = new Date(Date.UTC(seattleNow.year, seattleNow.month, 0)).getUTCDate();
  const isLastWeekdayOfMonth = seattleNow.dayOfMonth + 7 > daysInMonth;

  switch (recurrence.type) {
    case "monthly-nth-weekday":
      return Number(recurrence.nth) === -1
        ? isLastWeekdayOfMonth
        : occurrence === Number(recurrence.nth);
    case "monthly-multiple-nth-weekdays":
      return Array.isArray(recurrence.nth) && recurrence.nth.some((nth: unknown) => (Number(nth) === -1 ? isLastWeekdayOfMonth : occurrence === Number(nth)));
    case "monthly-last-weekday":
      return isLastWeekdayOfMonth;
    case "monthly-first-and-last-weekday":
      return occurrence === 1 || isLastWeekdayOfMonth;
    case "biweekly":
    case "bi-weekly":
    case "every-other-week": {
      const anchorStr = recurrence.anchorDate || recurrence.startDate || mic.anchorDate;
      if (!anchorStr) return false;
      const parts = String(anchorStr).split("-").map(Number);
      if (parts.length < 3 || parts.some(isNaN)) return false;
      const anchorUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
      const currentUtc = Date.UTC(seattleNow.year, seattleNow.month - 1, seattleNow.dayOfMonth);
      const diffDays = Math.round((currentUtc - anchorUtc) / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.round(diffDays / 7);
      return diffWeeks % 2 === 0;
    }
    default:
      return false;
  }
}

export function getNextOpenMicOccurrenceDate(mic: RecurrenceMic, afterDate: Date): Date | null {
  const start = getSeattleNow(afterDate);
  for (let daysAhead = 1; daysAhead <= 370; daysAhead += 1) {
    const candidate = new Date(Date.UTC(start.year, start.month - 1, start.dayOfMonth + daysAhead, 20));
    if (openMicOccursOnSeattleDate(mic, getSeattleNow(candidate))) return candidate;
  }
  return null;
}

export function formatUpcomingOpenMicDate(date: Date): string {
  const { year, month, dayOfMonth } = getSeattleNow(date);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
  return `${months[month - 1]} ${dayOfMonth} ${year}`;
}
