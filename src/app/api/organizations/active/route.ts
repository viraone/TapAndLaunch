import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { activeOrgCookieHeader } from "@/lib/org";

const SetActiveOrgSchema = z.object({
  organization_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = SetActiveOrgSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Confirm membership before switching — RLS would block any subsequent
  // data access anyway, but this keeps the cookie itself from ever pointing
  // at an org the user isn't in.
  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("organization_id", parsed.data.organization_id)
    .maybeSingle();

  if (!membership) {
    return Response.json({ error: "Not a member of that organization" }, { status: 403 });
  }

  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", activeOrgCookieHeader(parsed.data.organization_id));
  return response;
}
