import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppAdmin } from "@/lib/org";
import { describeLosses, type DeletionCounts } from "@/lib/apps/deletion";

/** What deleting this app would lose, in words, for the confirmation box. Admins only. */
export async function GET(_request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  if (!(await isAppAdmin(supabase, appId))) return Response.json({ error: "Not authorized" }, { status: 403 });

  const admin = createAdminClient();
  const count = async (table: "app_members" | "orders" | "form_submissions" | "bookings" | "push_subscriptions" | "products") => {
    const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq("app_id", appId);
    return count ?? 0;
  };
  const [members, orders, submissions, bookings, subscribers, products] = await Promise.all([
    count("app_members"),
    count("orders"),
    count("form_submissions"),
    count("bookings"),
    count("push_subscriptions"),
    count("products"),
  ]);
  const counts: DeletionCounts = { members, orders, submissions, bookings, subscribers, products };
  return Response.json({ losses: describeLosses(counts) });
}
