import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreatePageSchema = z.object({
  name: z.string().min(1).max(120),
  path: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use lowercase letters, numbers, and hyphens only"),
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

  const parsed = CreatePageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { count } = await supabase
    .from("pages")
    .select("*", { count: "exact", head: true })
    .eq("app_id", appId);

  const { data: page, error } = await supabase
    .from("pages")
    .insert({
      app_id: appId,
      name: parsed.data.name,
      path: parsed.data.path,
      is_home: false,
      position: count ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    const message = error.code === "23505" ? "A page with that path already exists" : error.message;
    return Response.json({ error: message }, { status: 400 });
  }

  return Response.json({ page }, { status: 201 });
}
