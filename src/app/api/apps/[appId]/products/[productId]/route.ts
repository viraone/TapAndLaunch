import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  price_cents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  image_url: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ appId: string; productId: string }> }
) {
  const { productId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = UpdateProductSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: product, error } = await supabase
    .from("products")
    .update(parsed.data)
    .eq("id", productId)
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ product });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ appId: string; productId: string }> }
) {
  const { productId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
