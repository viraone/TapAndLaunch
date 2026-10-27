import { toHtml } from "seositetuneup";
import type { Report } from "seositetuneup";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Renders one saved site-check report as a self-contained HTML page. No listing route: only a known id opens it. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response("Not found.", { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("site_checks").select("report").eq("id", id).single();
  if (error || !data) return new Response("Not found.", { status: 404 });

  return new Response(toHtml(data.report as unknown as Report), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
