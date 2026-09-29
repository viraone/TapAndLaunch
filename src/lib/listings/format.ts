import type { OpenMic } from "./record";

export function formatMinutesToClock(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null;
  const normalizedMinutes = ((Number(minutes) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function buildOpenMicTimeLabel(mic: Pick<OpenMic, "name" | "startMinutes">): string {
  if (mic.name === "Spice of Life Variety Open Mic") {
    return "6:00 PM - Midnight";
  }
  const startLabel = formatMinutesToClock(mic.startMinutes);
  if (startLabel) return `Start ${startLabel}`;
  return "Time not listed";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "See September List" when the list's label names a month, else "See List". */
export function buildOpenMicListButtonLabel(listLabel: string): string {
  const month = MONTH_NAMES.find((name) => new RegExp(`\\b${name}\\b`, "i").test(listLabel));
  return month ? `See ${month} List` : "See List";
}
