import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const PublishSchema = z.object({
  status: z.enum(["draft", "published"]),
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

  const parsed = PublishSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: app, error } = await supabase
    .from("apps")
    .update({ status: parsed.data.status })
    .eq("id", appId)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ app });
}
