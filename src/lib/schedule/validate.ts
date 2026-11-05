import type { ScheduleVisitStatus } from "@/types/database";

export interface CustomerInput {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  entry_notes: string | null;
  notes: string | null;
}

export interface VisitInput {
  customer_id: string;
  date: string;
  time: string;
  duration_minutes: number;
  service: string | null;
  notes: string | null;
  repeat_every_weeks: number | null;
  repeat_until: string | null;
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRealDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function optionalText(
  value: unknown,
  maxLength: number,
  label: string
): ParseResult<string | null> {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: `${label} is not valid.` };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${label} must be ${maxLength} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

export function parseCustomerInput(body: unknown): ParseResult<CustomerInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Could not read the customer details." };
  }

  const rawName = body.name;
  if (typeof rawName !== "string" || rawName.trim().length === 0) {
    return { ok: false, error: "Enter a name." };
  }
  const name = rawName.trim();
  if (name.length > 120) {
    return { ok: false, error: "Name must be 120 characters or fewer." };
  }

  let email: string | null = null;
  if (body.email !== undefined && body.email !== null) {
    if (typeof body.email !== "string") {
      return { ok: false, error: "Enter a valid email address." };
    }
    const trimmedEmail = body.email.trim().toLowerCase();
    if (trimmedEmail.length > 0) {
      if (trimmedEmail.length > 254 || !EMAIL_RE.test(trimmedEmail)) {
        return { ok: false, error: "Enter a valid email address." };
      }
      email = trimmedEmail;
    }
  }

  const phone = optionalText(body.phone, 500, "Phone");
  if (!phone.ok) return phone;
  const address = optionalText(body.address, 500, "Address");
  if (!address.ok) return address;
  const entryNotes = optionalText(body.entry_notes, 2000, "Entry notes");
  if (!entryNotes.ok) return entryNotes;
  const notes = optionalText(body.notes, 2000, "Notes");
  if (!notes.ok) return notes;

  return {
    ok: true,
    value: {
      name,
      email,
      phone: phone.value,
      address: address.value,
      entry_notes: entryNotes.value,
      notes: notes.value,
    },
  };
}

export function parseVisitInput(body: unknown): ParseResult<VisitInput> {
  if (!isRecord(body)) {
    return { ok: false, error: "Could not read the visit details." };
  }

  const customerId =
    typeof body.customer_id === "string" ? body.customer_id.trim() : "";
  if (!UUID_RE.test(customerId)) {
    return { ok: false, error: "Choose a customer." };
  }

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!isRealDate(date)) {
    return { ok: false, error: "Enter a valid date." };
  }

  const time = typeof body.time === "string" ? body.time.trim() : "";
  if (!TIME_RE.test(time)) {
    return { ok: false, error: "Enter a valid time." };
  }

  const duration = body.duration_minutes;
  if (
    typeof duration !== "number" ||
    !Number.isInteger(duration) ||
    duration < 15 ||
    duration > 720
  ) {
    return {
      ok: false,
      error: "Duration must be between 15 and 720 minutes.",
    };
  }

  let repeatEveryWeeks: number | null = null;
  if (body.repeat_every_weeks !== undefined && body.repeat_every_weeks !== null) {
    const repeat = body.repeat_every_weeks;
    if (
      typeof repeat !== "number" ||
      !Number.isInteger(repeat) ||
      repeat < 1 ||
      repeat > 12
    ) {
      return { ok: false, error: "Repeat must be every 1 to 12 weeks." };
    }
    repeatEveryWeeks = repeat;
  }

  let repeatUntil: string | null = null;
  if (
    repeatEveryWeeks !== null &&
    body.repeat_until !== undefined &&
    body.repeat_until !== null
  ) {
    const until =
      typeof body.repeat_until === "string" ? body.repeat_until.trim() : "";
    if (!isRealDate(until)) {
      return { ok: false, error: "Enter a valid last date." };
    }
    if (until < date) {
      return {
        ok: false,
        error: "The last date cannot be before the visit date.",
      };
    }
    repeatUntil = until;
  }

  const service = optionalText(body.service, 500, "Service");
  if (!service.ok) return service;
  const notes = optionalText(body.notes, 2000, "Notes");
  if (!notes.ok) return notes;

  return {
    ok: true,
    value: {
      customer_id: customerId,
      date,
      time,
      duration_minutes: duration,
      service: service.value,
      notes: notes.value,
      repeat_every_weeks: repeatEveryWeeks,
      repeat_until: repeatUntil,
    },
  };
}

export const VISIT_STATUSES: readonly ScheduleVisitStatus[] = [
  "scheduled",
  "confirmed",
  "reschedule_requested",
  "cancelled",
  "done",
];

export function isVisitStatus(value: unknown): value is ScheduleVisitStatus {
  return (
    typeof value === "string" &&
    (VISIT_STATUSES as readonly string[]).includes(value)
  );
}
