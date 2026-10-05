import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Starter } from "@/lib/apps/templates";
import { sampleEventRows } from "@/lib/apps/sample-events";
import { orgHasMaps } from "@/lib/platform/maps";
import { MAPS_LOCKED_MESSAGE, isMapsBlock } from "@/lib/platform/maps-shared";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];

/** `maple` -> `maple`, `maple-2`, `maple-3`... for when the address is taken. */
export function slugCandidates(slug: string): string[] {
  return [slug, ...[2, 3, 4, 5].map((n) => `${slug.slice(0, 60)}-${n}`)];
}

/**
 * Creates an app, with its pages and blocks, from a starter. RLS (`is_org_editor`) is the real authorization check:
 * there is no membership lookup here, so a non-member's insert is rejected by Postgres, not by application logic
 * that could drift out of sync with it. Shared by "pick a template" and "describe your app".
 */
export async function createAppFromStarter(
  supabase: SupabaseClient<Database>,
  user: User,
  input: { organizationId: string; name: string; slug: string; starter: Starter }
): Promise<{ app: AppRow } | { error: string; status: number }> {
  const { organizationId, name, starter } = input;
  if (starter.pages.some((p) => p.blocks.some((b) => isMapsBlock(b.type))) && !(await orgHasMaps(organizationId))) {
    return { error: MAPS_LOCKED_MESSAGE, status: 403 };
  }

  let app: AppRow | null = null;
  let appError: { code?: string; message: string } | null = null;
  for (const slug of slugCandidates(input.slug)) {
    const result = await supabase
      .from("apps")
      .insert({ organization_id: organizationId, name, slug, theme: starter.theme, manifest: starter.manifest, created_by: user.id })
      .select("*")
      .single();
    if (!result.error) {
      app = result.data;
      appError = null;
      break;
    }
    appError = result.error;
    if (result.error.code !== "23505") break; // only "taken" is worth another number
  }
  if (!app) {
    const message = appError?.code === "23505" ? "That address is already taken. Try a different name." : (appError?.message ?? "Could not create the app");
    return { error: message, status: 400 };
  }

  // If any later step fails, remove the half-built app so the customer doesn't end up with an empty one they never asked for.
  const created = app;
  const fail = async (message: string) => {
    await supabase.from("apps").delete().eq("id", created.id);
    return { error: message, status: 400 };
  };

  const { data: pages, error: pageError } = await supabase
    .from("pages")
    .insert(starter.pages.map((p, position) => ({ app_id: created.id, name: p.name, path: p.path, is_home: p.isHome, position })))
    .select("id, path");
  if (pageError || !pages) return fail(pageError?.message ?? "Could not create the pages");

  const blockRows = starter.pages.flatMap((p) => {
    const pageId = pages.find((row) => row.path === p.path)?.id;
    return pageId ? p.blocks.map((b, position) => ({ page_id: pageId, type: b.type, position, config: b.config })) : [];
  });
  if (blockRows.length) {
    const { error: blockError } = await supabase.from("blocks").insert(blockRows);
    if (blockError) return fail(blockError.message);
  }

  // Sample classes or events, so a booking page has something in it on first open.
  if (starter.events?.length) {
    const { error: eventError } = await supabase.from("events").insert(sampleEventRows(created.id, starter.events));
    if (eventError) return fail(eventError.message);
  }
  if (starter.products?.length) {
    const { error: productError } = await supabase.from("products").insert(
      starter.products.map((p, position) => ({ app_id: created.id, name: p.name, description: p.description, price_cents: p.priceCents, image_url: p.image, position }))
    );
    if (productError) return fail(productError.message);
  }
  if (starter.listings?.length) {
    const { error: listingError } = await supabase.from("listings").insert(starter.listings.map((l) => ({ app_id: created.id, slug: l.slug, record: l.record })));
    if (listingError) return fail(listingError.message);
  }

  return { app: created };
}
