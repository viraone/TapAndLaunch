import { createClient } from "@/lib/supabase/server";

/** Removes a station from an app's directory. RLS (`org editors can write
 * their apps' gas stations`) is the authorization check. */
export async function DELETE(_request: Request, context: { params: Promise<{ appId: string; stationId: string }> }) {
  const { stationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("gas_stations").delete().eq("id", stationId);
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  return Response.json({ ok: true });
}
