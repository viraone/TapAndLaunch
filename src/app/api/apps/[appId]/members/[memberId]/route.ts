import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UpdateMemberSchema = z.object({
  tier: z.string().max(60),
});

/** Updates a member's tier. RLS (`org editors can update their apps' members`,
 * added in 0004) is the actual authorization check. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ appId: string; memberId: string }> }
) {
  const { memberId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = UpdateMemberSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: member, error } = await supabase
    .from("app_members")
    .update({ tier: parsed.data.tier })
    .eq("id", memberId)
    .select("id, email, display_name, tier, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ member });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ appId: string; memberId: string }> }
) {
  const { memberId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("app_members").delete().eq("id", memberId);
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
