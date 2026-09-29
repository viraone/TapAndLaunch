import { getSeattleNow } from "./time";
import { openMicOccursOnSeattleDate } from "./recurrence";
import type { OpenMic } from "./record";

export type SelectedDay = {
  dayName: string;
  todays: OpenMic[];
  nextMic: OpenMic | null;
  lastMic: OpenMic | null;
};

export function selectOpenMicsForSeattleDate(
  allMics: OpenMic[],
  date: Date,
  compareCurrentTime: boolean,
  distanceMiles?: (mic: OpenMic) => number | null | undefined
): SelectedDay {
  const seattleNow = getSeattleNow(date);
  const { dayName, minutesSinceMidnight } = seattleNow;

  const todays = allMics.filter((mic) => openMicOccursOnSeattleDate(mic, seattleNow)).slice();
  todays.sort((a, b) => {
    const timeA = a.startMinutes ?? a.signupMinutes ?? 9999;
    const timeB = b.startMinutes ?? b.signupMinutes ?? 9999;
    if (timeA !== timeB) return timeA - timeB;

    if (distanceMiles) {
      const distA = distanceMiles(a) ?? Infinity;
      const distB = distanceMiles(b) ?? Infinity;
      if (distA !== distB) return distA - distB;
    }

    return a.name.localeCompare(b.name);
  });

  let nextMic: OpenMic | null = null;
  if (compareCurrentTime) {
    const effectiveMinutes = (mic: OpenMic): number => mic.startMinutes ?? mic.signupMinutes ?? 9999;
    const started = todays.filter((mic) => effectiveMinutes(mic) <= minutesSinceMidnight);
    if (started.length > 0) {
      const currentTier = effectiveMinutes(started[started.length - 1]);
      nextMic = started.find((mic) => effectiveMinutes(mic) === currentTier) ?? null;
    } else {
      nextMic = todays[0] || null;
    }
  } else {
    nextMic = todays.length > 0 ? todays[0] : null;
  }

  const lastMic = todays.length > 1 ? todays[todays.length - 1] : (todays.length === 1 ? todays[0] : null);

  return { dayName, todays, nextMic, lastMic };
}
