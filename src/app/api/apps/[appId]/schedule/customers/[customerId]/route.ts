import { createClient } from "@/lib/supabase/server";
import { parseCustomerInput } from "@/lib/schedule/validate";

/** Updates a customer. RLS is the authorization check. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ appId: string; customerId: string }> }
) {
  const { appId, customerId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = parseCustomerInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { data: customer, error } = await supabase
    .from("schedule_customers")
    .update(parsed.value)
    .eq("id", customerId)
    .eq("app_id", appId)
    .select("*")
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (!customer) {
    return Response.json({ error: "Customer not found" }, { status: 404 });
  }

  return Response.json({ customer });
}

/** Deletes a customer; their visits and repeat rules go with it by cascade. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ appId: string; customerId: string }> }
) {
  const { appId, customerId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .from("schedule_customers")
    .delete()
    .eq("id", customerId)
    .eq("app_id", appId);

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}
