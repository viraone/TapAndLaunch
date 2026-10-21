import { createClient } from "@/lib/supabase/server";
import { isAppEditor } from "@/lib/org";
import { canBuyDomains, searchDomains } from "@/lib/domains/purchase";

/** Prices a name with each ending we sell, for the Domain tab's search box. `?q=` is words or a domain. */
export async function GET(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "Not authorized" }, { status: 403 });
  if (!canBuyDomains()) return Response.json({ error: "Buying domains is not set up on this server" }, { status: 503 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length === 0 || q.length > 100) return Response.json({ error: "Type a name to search for" }, { status: 400 });

  const { offers, error } = await searchDomains(q);
  if (error) return Response.json({ error }, { status: 400 });
  return Response.json({ offers });
}
