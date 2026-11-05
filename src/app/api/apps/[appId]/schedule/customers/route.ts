import { createClient } from "@/lib/supabase/server";
import { parseCustomerInput } from "@/lib/schedule/validate";

/** Adds a customer to the app's Scheduling list. RLS is the authorization check. */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
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
    .insert({ app_id: appId, ...parsed.value })
    .select("*")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ customer }, { status: 201 });
}
