import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const AddNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Note cannot be empty")
    .max(2000, "Note must be 2000 characters or fewer"),
});

/** Adds an internal note to an order. RLS (`org editors can add notes to
 * their apps' orders`, 0053) is the actual authorization check. */
export async function POST(
  request: Request,
  context: { params: Promise<{ appId: string; orderId: string }> }
) {
  const { appId, orderId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = AddNoteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("app_id", appId)
    .maybeSingle();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const { data: note, error } = await supabase
    .from("order_notes")
    .insert({
      order_id: orderId,
      author_id: user.id,
      author_email: user.email ?? null,
      body: parsed.data.body,
    })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ note });
}
