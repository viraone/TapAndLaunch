import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform/admin";

const Schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), title: z.string().trim().min(1).max(200), detail: z.string().trim().max(600).optional() }),
  z.object({ action: z.literal("done"), id: z.string().uuid(), done: z.boolean() }),
  z.object({ action: z.literal("remove"), id: z.string().uuid() }),
]);

/** Platform admins only: the daily board's to-do list. Add an item, tick or untick one, or remove one the admin typed in. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isPlatformAdmin(supabase))) return Response.json({ error: "Not allowed" }, { status: 403 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Type what needs doing." }, { status: 400 });

  const admin = createAdminClient();
  const body = parsed.data;
  if (body.action === "add") {
    const { data, error } = await admin.from("admin_todos").insert({ title: body.title, detail: body.detail || null, section: "Mine", sort: 0 }).select("id").single();
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true, id: data.id });
  }
  if (body.action === "done") {
    const { error } = await admin
      .from("admin_todos")
      .update(body.done ? { done_at: new Date().toISOString(), done_by: user.id } : { done_at: null, done_by: null })
      .eq("id", body.id);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    return Response.json({ ok: true });
  }
  // Only items typed in on the page can be removed; a seeded item would come straight back, so it is ticked instead.
  const { error } = await admin.from("admin_todos").delete().eq("id", body.id).is("key", null);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
