import type { OpenMic } from "./record";
import { formatMinutesToClock } from "./format";
import { getSeattleNow } from "./time";

// StageTime's travel estimates (app.js on stagetimepnw.com): straight-line
// distance, stretched to road miles, at city speeds. No routing service.
const EARTH_RADIUS_MILES = 3958.8;
const ESTIMATED_ROAD_DISTANCE_MULTIPLIER = 1.25;
const ESTIMATED_METRO_SPEED_MPH = 25;

export const TRIP_DEFAULT_PARKING_HUNT_MINUTES = 8;
export const TRIP_SIGNUP_FALLBACK = "Check with host or bar staff upon arrival.";
export const TRIP_PARKING_FALLBACK = "Street and nearby neighborhood parking available.";

export type LatLng = { latitude: number; longitude: number };

export type TravelEstimate = {
  distanceMiles: number;
  driveMinutes: number;
  transitMinutes: number;
};

function degreesToRadians(degrees: number): number {
  return (Number(degrees) * Math.PI) / 180;
}

export function calculateHaversineMiles(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
): number {
  const latitudeDelta = degreesToRadians(toLatitude - fromLatitude);
  const longitudeDelta = degreesToRadians(toLongitude - fromLongitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(degreesToRadians(fromLatitude)) * Math.cos(degreesToRadians(toLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateOpenMicDriveMinutes(straightLineMiles: number): number {
  const estimatedRoadMiles = Number(straightLineMiles) * ESTIMATED_ROAD_DISTANCE_MULTIPLIER;
  return Math.max(0, Math.round((estimatedRoadMiles / ESTIMATED_METRO_SPEED_MPH) * 60));
}

export function estimateOpenMicTransitMinutes(straightLineMiles: number): number {
  return Math.max(10, Math.round(((Number(straightLineMiles) * 1.3) / 12) * 60 + 8));
}

/** How far a mic is from the viewer, or null without a location or coordinates. */
export function getOpenMicTravelEstimate(
  mic: Pick<OpenMic, "latitude" | "longitude">,
  userLocation: LatLng | null
): TravelEstimate | null {
  if (!userLocation || mic.latitude === null || mic.longitude === null) return null;
  const distanceMiles = calculateHaversineMiles(
    userLocation.latitude,
    userLocation.longitude,
    mic.latitude,
    mic.longitude
  );
  return {
    distanceMiles,
    driveMinutes: estimateOpenMicDriveMinutes(distanceMiles),
    transitMinutes: estimateOpenMicTransitMinutes(distanceMiles),
  };
}

export function getTripTrafficCondition(driveMinutes: number): { label: string; className: string } {
  const minutes = Number(driveMinutes);
  if (minutes <= 20) return { label: "Clear", className: "text-emerald-400" };
  if (minutes <= 35) return { label: "Moderate", className: "text-yellow-400" };
  return { label: "Heavy", className: "text-red-400" };
}

/** An Open-Meteo weather code as StageTime shows it. */
export function getWeatherCondition(code: unknown): { emoji: string; label: string } {
  const n = Number(code);
  if (n === 0) return { emoji: "☀️", label: "Clear" };
  if (n === 1) return { emoji: "🌤️", label: "Mostly clear" };
  if ([2, 3].includes(n)) return { emoji: "⛅", label: "Partly cloudy" };
  if ([45, 48].includes(n)) return { emoji: "🌫️", label: "Fog" };
  if ([51, 53, 55, 56, 57].includes(n)) return { emoji: "🌦️", label: "Drizzle" };
  if ([61, 63, 65, 66, 67].includes(n)) return { emoji: "🌧️", label: "Rain" };
  if ([71, 73, 75, 77].includes(n)) return { emoji: "🌨️", label: "Snow" };
  if ([80, 81, 82].includes(n)) return { emoji: "🌦️", label: "Rain showers" };
  if ([85, 86].includes(n)) return { emoji: "🌨️", label: "Snow showers" };
  if ([95, 96, 99].includes(n)) return { emoji: "⛈️", label: "Thunderstorms" };
  return { emoji: "🌡️", label: "Conditions unavailable" };
}

/** OpenStreetMap parking near a venue, summed up with a guess at the hunt. */
export function summarizeNearbyParking(elements: unknown): { summary: string; huntMinutes: number } {
  if (!Array.isArray(elements) || elements.length === 0) {
    return { summary: TRIP_PARKING_FALLBACK, huntMinutes: 10 };
  }
  const feeValues = elements.map((element) =>
    String((element as { tags?: { fee?: unknown } } | null)?.tags?.fee || "").toLowerCase()
  );
  const hasFree = feeValues.some((fee) => ["no", "free"].includes(fee));
  const hasPaid = feeValues.some((fee) => ["yes", "paid"].includes(fee));
  const parkingType = hasFree
    ? "Free parking is mapped nearby."
    : hasPaid
      ? "Paid parking or meters are mapped nearby."
      : "Parking is mapped nearby; check access signs and posted restrictions.";
  const countLabel = `${elements.length} mapped parking ${elements.length === 1 ? "option" : "options"} within 300 m.`;
  return {
    summary: `${countLabel} ${parkingType}`,
    huntMinutes: elements.length >= 4 ? 4 : hasFree ? 6 : 7,
  };
}

function escapeIcsText(value: unknown): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsFloatingDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(
    date.getUTCMinutes()
  )}00`;
}

/** StageTime's "Set Alarm" calendar file: a reminder to leave, driving and
 * parking time before the sign-up (or start) on the selected day. Null when
 * the mic has neither time. `now` stamps the file. */
export function buildTripReminder(
  mic: OpenMic,
  totalMinutes: number,
  selectedDate: Date,
  now: Date
): { ics: string; fileName: string; leaveAtLabel: string } | null {
  const signupMinutes = mic.signupMinutes ?? mic.startMinutes;
  if (signupMinutes === null) return null;

  const day = getSeattleNow(selectedDate);
  // Seattle wall-clock time held in UTC fields: written out with TZID below.
  const signupAt = new Date(
    Date.UTC(day.year, day.month - 1, day.dayOfMonth, Math.floor(signupMinutes / 60), signupMinutes % 60)
  );
  const leaveAt = new Date(signupAt.getTime() - totalMinutes * 60 * 1000);
  const reminderEnds = new Date(leaveAt.getTime() + 15 * 60 * 1000);
  const venueName = mic.venue || mic.name;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rickshaw//Trip Venue Intel//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${now.getTime()}-${escapeIcsText(mic.id)}@rickshaw`,
    `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;TZID=America/Los_Angeles:${formatIcsFloatingDate(leaveAt)}`,
    `DTEND;TZID=America/Los_Angeles:${formatIcsFloatingDate(reminderEnds)}`,
    `SUMMARY:${escapeIcsText(`Leave now for ${venueName}`)}`,
    `LOCATION:${escapeIcsText(mic.address)}`,
    `DESCRIPTION:${escapeIcsText(
      `Allow ${totalMinutes} minutes for driving and parking before ${formatMinutesToClock(signupMinutes)} sign-up.`
    )}`,
    "BEGIN:VALARM",
    "TRIGGER:PT0M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcsText(`Leave now for ${venueName}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return {
    ics,
    fileName: `leave-for-${String(mic.id || "open-mic").replace(/[^a-z0-9-]+/gi, "-")}.ics`,
    leaveAtLabel: formatMinutesToClock(signupMinutes - totalMinutes) ?? "",
  };
}
