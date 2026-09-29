import { isOpenMicDayActive, normalizeOpenMicContact, parseSignupStartTimes } from "./parse";
import { formatSeattleIsoDate } from "./time";

export const OPEN_MIC_DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const OPEN_MIC_COORDINATE_OVERRIDES: Record<string, { latitude: number; longitude: number }> =
  {
    "spice-of-life-variety-open-mic-darren-s-speakeasy-renton-wa": {
      latitude: 47.4797,
      longitude: -122.2031,
    },
  };

export type OpenMic = {
  id: string;
  name: string;
  venue: string;
  address: string;
  rawTime: string;
  signupMinutes: number | null;
  startMinutes: number | null;
  days: Record<string, boolean>;
  recurrence: Record<string, unknown> | null;
  anchorDate: string;
  recurrenceText: string;
  signupType: string;
  signupDetails: string;
  showWhenInactive: boolean;
  price: string;
  micType: string;
  ageRequirement: string;
  notes: string;
  signupLocationNote: string;
  parkingHuntMinutes: number | null;
  host: string;
  hostSchedule: Record<string, string>;
  wheelchairAccessible: boolean;
  website: string;
  contact: string;
  contactLabel: string;
  contactIsLink: boolean;
  listLabel: string;
  listUrl: string;
  latitude: number | null;
  longitude: number | null;
};

export function normalizeOpenMicRecord(record: unknown): OpenMic | null {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- a StageTime record is untyped JSON; its fields are read loosely as in the original
  const r = record as Record<string, any>;
  const name = String(r.name || "").trim();
  if (!name) return null;

  const rawTime = String(r.timeSignupStart || "").trim();
  const { signupMinutes, startMinutes } = parseSignupStartTimes(rawTime);

  const days: Record<string, boolean> = {};
  OPEN_MIC_DAY_NAMES.forEach((day) => {
    days[day] = isOpenMicDayActive(r[day.toLowerCase()]);
  });

  const website = String(r.webSignup || "").trim();
  const contact = normalizeOpenMicContact(r.contact);
  const listLabel = String(r.listLabel || "").trim();
  const listUrl = String(r.listUrl || "").trim();
  const coordinateOverride = OPEN_MIC_COORDINATE_OVERRIDES[String(r.id || "").trim()];
  const latitude = Number(r.latitude ?? coordinateOverride?.latitude);
  const longitude = Number(r.longitude ?? coordinateOverride?.longitude);

  return {
    id: String(r.id || "").trim(),
    name,
    venue: String(r.venue || "").trim(),
    address: String(r.location || "").trim(),
    rawTime,
    signupMinutes,
    startMinutes,
    days,
    recurrence:
      r.recurrence && typeof r.recurrence === "object" && !Array.isArray(r.recurrence)
        ? (r.recurrence as Record<string, unknown>)
        : null,
    anchorDate: String(
      r.anchorDate || r.recurrence?.anchorDate || r.recurrence?.startDate || ""
    ).trim(),
    recurrenceText: String(r.recurrenceText || "").trim(),
    signupType: String(r.signupType || "").trim().toLowerCase(),
    signupDetails: String(r.signupDetails || r.signupInstructions || "").trim(),
    showWhenInactive: r.showWhenInactive === true,
    price: String(r.priceForTime || "").trim(),
    micType: String(r.openMicType || "").trim(),
    ageRequirement: String(r.ageRequirement || "").trim(),
    notes: String(r.requirementsInfo || "").trim(),
    signupLocationNote: String(r.signupLocationNote || "").trim(),
    parkingHuntMinutes: Number.isFinite(Number(r.parkingHuntMins))
      ? Math.max(0, Math.round(Number(r.parkingHuntMins)))
      : null,
    host: String(r.host || "").trim(),
    hostSchedule: normalizeHostSchedule(r.hostSchedule),
    wheelchairAccessible: r.wheelchairAccessible === true,
    website: /^https?:\/\//i.test(website) ? website : "",
    contact: contact.href,
    contactLabel: contact.label,
    contactIsLink: contact.isLink,
    listLabel,
    listUrl: /^https?:\/\//i.test(listUrl) ? listUrl : "",
    latitude: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null,
    longitude: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null,
  };
}

function normalizeHostSchedule(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([date, host]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && String(host || "").trim())
    .map(([date, host]) => [date, String(host).trim()] as const);
  return Object.fromEntries(entries);
}

export function getOpenMicHost(mic: OpenMic, date: unknown): string {
  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    const scheduled = mic.hostSchedule?.[formatSeattleIsoDate(date)];
    if (scheduled) return scheduled;
  }
  return mic.host;
}
