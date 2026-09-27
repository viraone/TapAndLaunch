import { z } from "zod";
import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";

const SubmitSchema = z.object({
  pageId: z.string().uuid(),
  data: z.record(z.string(), z.string()),
});

/**
 * Receives a contact-form submission from `ContactFormRuntime`. No rate
 * limiting or spam filtering yet — fine for a Phase 2 scaffold, but a real
 * deployment needs at least one of the two before this is public.
 */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = SubmitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // The page must actually belong to this app — otherwise a crafted request
  // could attribute a submission to an arbitrary page id from a different
  // app entirely.
  const page = published.pages.find((p) => p.id === parsed.data.pageId);
  if (!page) {
    return Response.json({ error: "Invalid page" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("form_submissions").insert({
    app_id: published.app.id,
    page_id: page.id,
    data: parsed.data.data,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
