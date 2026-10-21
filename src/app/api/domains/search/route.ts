import { canBuyDomains, searchDomains } from "@/lib/domains/purchase";
import { allowSearch, clientAddress } from "@/lib/domains/search-limit";

/** The public domain search (tapandlaunch.com/domains): no account needed, a few searches a minute per visitor. */
export async function GET(request: Request) {
  if (!canBuyDomains()) return Response.json({ error: "Domain search isn't available right now. Try again later." }, { status: 503 });
  if (!allowSearch(clientAddress(request))) return Response.json({ error: "That's a lot of searches. Give it a minute and try again." }, { status: 429 });

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length === 0 || q.length > 100) return Response.json({ error: "Type a name to search for" }, { status: 400 });

  const { offers, error } = await searchDomains(q);
  if (error) return Response.json({ error }, { status: 400 });
  return Response.json({ offers });
}
