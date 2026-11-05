import { createClient } from "@/lib/supabase/server";

function validTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Turns Scheduling on for the app (the row is the switch) and saves its time
 * zone and default visit length. RLS is the authorization check.
 */
export async function PUT(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const input =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const timeZone =
    typeof input.time_zone === "string" ? input.time_zone.trim() : "";
  if (!validTimeZone(timeZone)) {
    return Response.json({ error: "Pick a valid time zone." }, { status: 400 });
  }

  const patch: {
    app_id: string;
    time_zone: string;
    default_duration_minutes?: number;
  } = { app_id: appId, time_zone: timeZone };

  const duration = input.default_duration_minutes;
  if (duration !== undefined) {
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
    patch.default_duration_minutes = duration;
  }

  const { data: settings, error } = await supabase
    .from("schedule_settings")
    .upsert(patch, { onConflict: "app_id" })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ settings });
}
