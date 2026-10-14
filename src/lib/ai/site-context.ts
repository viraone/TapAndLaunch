import type { SupabaseClient } from "@supabase/supabase-js";
import type { Draft } from "@/lib/ai/builder-ops";
import { collectConfigCopy } from "@/lib/ai/copy-fields";
import type { BlockConfig, BlockType, Database, ManifestConfig, ThemeConfig } from "@/types/database";

/**
 * Everything the AI should know about a site before it changes any part of it: the business, every page, every
 * section's words, the upcoming events and the products. Handed to Cmd+K, the agent and the paste inbox, so a change
 * to one section can lean on the rest ("mention my Friday show" finds the show; "our name is X" is spelled the way
 * the rest of the site spells it). Words only: no addresses of photos, no settings.
 */
export interface Site {
  app: { id: string; name: string; organization_id: string; status: string; theme: ThemeConfig; manifest: ManifestConfig };
  draft: Draft;
  events: Array<{ id: string; title: string; starts_at: string; location: string | null; ticket_url: string | null; description: string | null }>;
  products: Array<{ name: string; price_cents: number; description: string | null }>;
}

export async function loadSite(supabase: SupabaseClient<Database>, appId: string): Promise<Site | null> {
  const { data: app } = await supabase.from("apps").select("id, name, organization_id, status, theme, manifest").eq("id", appId).maybeSingle();
  if (!app) return null;
  const since = new Date();
  since.setHours(since.getHours() - 6);
  const [{ data: pages }, { data: events }, { data: products }] = await Promise.all([
    supabase.from("pages").select("id, name, path, is_home, position").eq("app_id", appId).order("position", { ascending: true }),
    supabase.from("events").select("id, title, starts_at, location, ticket_url, description").eq("app_id", appId).gte("starts_at", since.toISOString()).order("starts_at", { ascending: true }).limit(20),
    supabase.from("products").select("name, price_cents, description").eq("app_id", appId).eq("is_active", true).order("position").limit(20),
  ]);
  const pageIds = (pages ?? []).map((p) => p.id);
  const { data: blocks } = pageIds.length
    ? await supabase.from("blocks").select("page_id, type, config, min_tier, position").in("page_id", pageIds).order("position", { ascending: true })
    : { data: [] };
  const draft: Draft = {
    theme: app.theme as ThemeConfig,
    pages: (pages ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      path: p.path,
      isHome: p.is_home,
      blocks: (blocks ?? []).filter((b) => b.page_id === p.id).map((b) => ({ type: b.type as BlockType, config: b.config as BlockConfig, min_tier: b.min_tier })),
    })),
  };
  return { app: { ...app, theme: app.theme as ThemeConfig, manifest: app.manifest as ManifestConfig }, draft, events: events ?? [], products: products ?? [] };
}

const BODY_CAP = 400;

/** The site as the model reads it: JSON, words keyed by their field path so an answer can point back at them. */
export function describeSite(site: Site): string {
  const summary = {
    name: site.app.name,
    about: site.app.manifest.description ?? "",
    tagline: site.app.theme.header_tagline ?? "",
    announcement: site.app.theme.announcement?.enabled ? site.app.theme.announcement.text ?? "" : "",
    pages: site.draft.pages.map((p) => ({
      name: p.name,
      path: p.path,
      home: p.isHome,
      sections: p.blocks.map((b, index) => ({
        index,
        type: b.type,
        words: Object.fromEntries(collectConfigCopy(b.type, b.config as Record<string, unknown>).map((f) => [f.key.replace(/\//g, "."), f.text.length > BODY_CAP ? `${f.text.slice(0, BODY_CAP)}…` : f.text])),
      })),
    })),
    upcoming_events: site.events.map((e) => ({ title: e.title, starts_at: e.starts_at, location: e.location ?? undefined, tickets: e.ticket_url ? "yes" : undefined })),
    products: site.products.map((p) => ({ name: p.name, price: `$${(p.price_cents / 100).toFixed(2)}` })),
  };
  return JSON.stringify(summary);
}

/**
 * Writes a changed draft back: removed pages, new pages, pages whose blocks changed, and the theme. Uses the owner's
 * own session so the database's rules apply to every write. Returns an error message, or null. Pages that are new
 * get their id filled in on `after`.
 */
export async function saveDraft(supabase: SupabaseClient<Database>, appId: string, before: Draft, after: Draft): Promise<string | null> {
  const removed = before.pages.filter((p) => p.id && !after.pages.some((q) => q.id === p.id));
  if (removed.length) {
    const { error } = await supabase.from("pages").delete().in("id", removed.map((p) => p.id as string));
    if (error) return error.message;
  }
  for (const [position, page] of after.pages.entries()) {
    let pageId = page.id;
    if (!pageId) {
      const { data, error } = await supabase.from("pages").insert({ app_id: appId, name: page.name, path: page.path, is_home: false, position }).select("id").single();
      if (error || !data) return error?.message ?? "Couldn't add a page";
      pageId = data.id;
      page.id = pageId;
    }
    const old = before.pages.find((p) => p.id === page.id);
    if (old && JSON.stringify(old.blocks) === JSON.stringify(page.blocks)) continue;
    const { error: deleteError } = await supabase.from("blocks").delete().eq("page_id", pageId);
    if (deleteError) return deleteError.message;
    if (page.blocks.length) {
      const { error } = await supabase.from("blocks").insert(page.blocks.map((b, i) => ({ page_id: pageId as string, type: b.type, config: b.config, min_tier: b.min_tier, position: i })));
      if (error) return error.message;
    }
  }
  if (JSON.stringify(before.theme) !== JSON.stringify(after.theme)) {
    const { error } = await supabase.from("apps").update({ theme: after.theme }).eq("id", appId);
    if (error) return error.message;
  }
  return null;
}
