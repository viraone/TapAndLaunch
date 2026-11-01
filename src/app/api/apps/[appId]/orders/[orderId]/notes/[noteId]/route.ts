import { createClient } from "@/lib/supabase/server";

/** Deletes one internal note, provided it belongs to this app's order. RLS
 * (`org editors can delete their apps' order notes`, 0053) is the actual
 * authorization check. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ appId: string; orderId: string; noteId: string }> }
) {
  const { appId, orderId, noteId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("app_id", appId)
    .maybeSingle();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });

  const { data: deleted, error } = await supabase
    .from("order_notes")
    .delete()
    .eq("id", noteId)
    .eq("order_id", orderId)
    .select("id")
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (!deleted) {
    return Response.json({ error: "Note not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
