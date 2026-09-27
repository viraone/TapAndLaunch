import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price_cents: z.number().int().min(0),
  currency: z.string().length(3).optional(),
  image_url: z.string().optional(),
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

  const parsed = CreateProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({ app_id: appId, ...parsed.data })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ product }, { status: 201 });
}
