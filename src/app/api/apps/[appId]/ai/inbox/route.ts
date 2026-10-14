import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppEditor } from "@/lib/org";
import { NO_AI_MESSAGE, resolveAsker } from "@/lib/ai/ask";
import { countUsage } from "@/lib/ai/usage";
import { describeSite, loadSite } from "@/lib/ai/site-context";
import { extractUpdate, imageFromBytes } from "@/lib/ai/inbox";
import { applyExtraction } from "@/lib/ai/inbox-apply";
import { isProviderError } from "@/lib/ai/providers";
import { SAMPLE_TIME_ZONE } from "@/lib/apps/sample-events";

const Schema = z
  .object({
    text: z.string().max(6000).optional(),
    /** The address of a picture the owner just uploaded to their own storage (a flyer, a screenshot). */
    image_url: z.string().url().max(2000).optional(),
    time_zone: z.string().max(60).optional(),
  })
  .refine((v) => (v.text ?? "").trim() || v.image_url, "Paste something first");

export const maxDuration = 60;

/**
 * Paste anything: a flyer, a post, an email. The model works out what it means for the site, and the changes are
 * saved at once (the owner is on the Quick updates page to see them) with everything needed to undo them.
 */
export async function POST(request: Request, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isAppEditor(supabase, appId))) return Response.json({ error: "You can't edit this app" }, { status: 403 });

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Paste some text or a picture first." }, { status: 400 });

  const site = await loadSite(supabase, appId);
  if (!site) return Response.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const asker = await resolveAsker(admin, site.app.organization_id);
  if (!asker) return Response.json({ error: NO_AI_MESSAGE, needsKey: true }, { status: 400 });

  let image;
  if (parsed.data.image_url) {
    if (!asker.vision) return Response.json({ error: "Pictures need Claude. Paste the words instead, or add an Anthropic key." }, { status: 400 });
    image = await fetchImage(parsed.data.image_url);
    if (!image) return Response.json({ error: "Couldn't read that picture. Try a JPG or PNG under 10 MB." }, { status: 400 });
  }

  const over = await countUsage(admin, { userId: user.id, organizationId: site.app.organization_id, kind: "inbox", details: { app_id: appId, source: asker.source, image: !!image } });
  if (over) return Response.json({ error: over }, { status: 429 });

  try {
    const found = await extractUpdate({ site: describeSite(site), text: parsed.data.text, image, timeZone: parsed.data.time_zone || SAMPLE_TIME_ZONE, ask: asker.ask });
    if (!found) return Response.json({ error: "Couldn't make sense of that. Try pasting just the words." }, { status: 422 });
    const outcome = await applyExtraction(supabase, site, found);
    return Response.json(outcome);
  } catch (error) {
    if (isProviderError(error)) return Response.json({ error: error.message }, { status: 502 });
    return Response.json({ error: "The AI didn't answer in time. Try again." }, { status: 504 });
  }
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Only pictures from our own storage (the owner just uploaded it there). */
async function fetchImage(url: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl || !url.startsWith(`${supabaseUrl}/storage/`)) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!res?.ok) return null;
  const type = res.headers.get("content-type")?.split(";")[0] ?? "";
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
  return imageFromBytes(bytes, type);
}
