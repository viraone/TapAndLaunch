import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UpdateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  starts_at: z.string().min(1).optional(),
  ends_at: z.string().nullable().optional(),
  capacity: z.number().int().min(1).nullable().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ appId: string; eventId: string }> }) {
  const { eventId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = UpdateEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: event, error } = await supabase
    .from("events")
    .update(parsed.data)
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ event });
}

export async function DELETE(_request: Request, context: { params: Promise<{ appId: string; eventId: string }> }) {
  const { eventId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
