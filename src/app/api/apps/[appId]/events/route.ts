import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(300).optional(),
  // Accepts whatever a <input type="datetime-local"> or a full ISO string
  // sends (the former has no timezone offset, so a strict `.datetime()`
  // check would reject it) — Postgres rejects anything that isn't actually
  // a valid timestamp at insert time, with a clear error either way.
  starts_at: z.string().min(1),
  ends_at: z.string().optional(),
  capacity: z.number().int().min(1).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = CreateEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: event, error } = await supabase
    .from("events")
    .insert({ app_id: appId, ...parsed.data })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ event }, { status: 201 });
}
