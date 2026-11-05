import type { ScheduleVisitStatus } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { zonedTimeToUtc } from "@/lib/schedule/recurrence";
import { isVisitStatus } from "@/lib/schedule/validate";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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

type TextResult = { ok: true; value: string | null } | { ok: false; error: string };

function readText(value: unknown, maxLength: number, label: string): TextResult {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") {
    return { ok: false, error: `${label} is not valid.` };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > maxLength) {
    return {
      ok: false,
      error: `${label} must be ${maxLength} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

type VisitPatch = {
  status?: ScheduleVisitStatus;
  starts_at?: string;
  duration_minutes?: number;
  service?: string | null;
  notes?: string | null;
  confirmed_at?: string | null;
};

/** Changes what the owner can change on a visit; occurrence_on always stays put. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ appId: string; visitId: string }> }
) {
  const { appId, visitId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json(
      { error: "Could not read the visit details." },
      { status: 400 }
    );
  }
  const input = body as Record<string, unknown>;
  const patch: VisitPatch = {};

  if (input.status !== undefined) {
    if (!isVisitStatus(input.status)) {
      return Response.json({ error: "Pick a valid status." }, { status: 400 });
    }
    patch.status = input.status;
    patch.confirmed_at =
      input.status === "confirmed" ? new Date().toISOString() : null;
  }

  const hasDate = input.date !== undefined;
  const hasTime = input.time !== undefined;
  if (hasDate !== hasTime) {
    return Response.json(
      { error: "Send the date and time together." },
      { status: 400 }
    );
  }

  if (hasDate && hasTime) {
    const date = typeof input.date === "string" ? input.date.trim() : "";
    if (!isRealDate(date)) {
      return Response.json({ error: "Enter a valid date." }, { status: 400 });
    }

    const time = typeof input.time === "string" ? input.time.trim() : "";
    if (!TIME_RE.test(time)) {
      return Response.json({ error: "Enter a valid time." }, { status: 400 });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("schedule_settings")
      .select("time_zone")
      .eq("app_id", appId)
      .maybeSingle();
    if (settingsError) {
      return Response.json({ error: settingsError.message }, { status: 400 });
    }
    if (!settings) {
      return Response.json(
        { error: "Scheduling isn't turned on for this app yet." },
        { status: 400 }
      );
    }

    patch.starts_at = zonedTimeToUtc(date, time, settings.time_zone).toISOString();
  }

  if (input.duration_minutes !== undefined) {
    const duration = input.duration_minutes;
    if (
      typeof duration !== "number" ||
      !Number.isInteger(duration) ||
      duration < 15 ||
      duration > 720
    ) {
      return Response.json(
        { error: "Duration must be between 15 and 720 minutes." },
        { status: 400 }
      );
    }
    patch.duration_minutes = duration;
  }

  if (input.service !== undefined) {
    const service = readText(input.service, 500, "Service");
    if (!service.ok) {
      return Response.json({ error: service.error }, { status: 400 });
    }
    patch.service = service.value;
  }

  if (input.notes !== undefined) {
    const notes = readText(input.notes, 2000, "Notes");
    if (!notes.ok) {
      return Response.json({ error: notes.error }, { status: 400 });
    }
    patch.notes = notes.value;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { data: visit, error } = await supabase
    .from("schedule_visits")
    .update(patch)
    .eq("id", visitId)
    .eq("app_id", appId)
    .select("*")
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (!visit) {
    return Response.json({ error: "Visit not found" }, { status: 404 });
  }

  return Response.json({ visit });
}

/**
 * Deletes a one-off visit. A visit made by a repeat rule is cancelled instead:
 * deleting it would let the rule create it again.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ appId: string; visitId: string }> }
) {
  const { appId, visitId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: visit, error } = await supabase
    .from("schedule_visits")
    .select("*")
    .eq("id", visitId)
    .eq("app_id", appId)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (!visit) {
    return Response.json({ error: "Visit not found" }, { status: 404 });
  }

  if (visit.series_id !== null) {
    const { data: cancelled, error: cancelError } = await supabase
      .from("schedule_visits")
      .update({ status: "cancelled", confirmed_at: null })
      .eq("id", visitId)
      .eq("app_id", appId)
      .select("*")
      .single();

    if (cancelError) {
      return Response.json({ error: cancelError.message }, { status: 400 });
    }

    return Response.json({ visit: cancelled });
  }

  const { error: deleteError } = await supabase
    .from("schedule_visits")
    .delete()
    .eq("id", visitId)
    .eq("app_id", appId);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
