import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { PREVIEW_HEADER, verifyPreviewToken } from "@/lib/pwa/preview";
import type { Database } from "@/types/database";

type AppRow = Database["public"]["Tables"]["apps"]["Row"];
type PageRow = Database["public"]["Tables"]["pages"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];

export interface PublishedApp {
  app: AppRow;
  pages: PageRow[];
  /** Opened with the builder's preview key (lib/pwa/preview.ts): the owner trying their app, not a visitor. */
  preview: boolean;
}

/**
 * Loads a published app by its subdomain slug for the PWA runtime. Uses the
 * service-role client because visitors of a published app are anonymous —
 * there is no Supabase Auth session to satisfy the `apps` RLS policy with.
 * Draft apps resolve to `null` so an unpublished app can never leak by
 * guessing its slug.
 *
 * Returns `null` rather than calling `notFound()` itself: this is shared by
 * both page/layout Server Components (which can call `notFound()`) and
 * Route Handlers for `manifest.webmanifest` / `sw.js` (which can't — that
 * helper only works in the render path) — each caller decides how to turn
 * "no app" into a response.
 *
 * Wrapped in React's `cache()` so `generateMetadata`, `generateViewport`,
 * and the page/layout components — which each call this independently for
 * the same request — share one Supabase round trip instead of four.
 */
/** True when this address belongs to a published app that TapAndLaunch took down (to explain why it's gone). */
export const isTakenDown = cache(async (slug: string): Promise<boolean> => {
  const { data } = await createAdminClient().from("apps").select("id").eq("slug", slug).eq("status", "published").not("suspended_at", "is", null).maybeSingle();
  return data !== null;
});

export const getPublishedApp = cache(async (slug: string): Promise<PublishedApp | null> => {
  const admin = createAdminClient();

  // The one exception to "drafts are never served": the builder's "Try it" mode, whose signed key the proxy passes
  // along in a header. It is checked against this slug and its expiry before a draft is allowed through.
  const preview = verifyPreviewToken((await headers()).get(PREVIEW_HEADER), slug);

  let query = admin
    .from("apps")
    .select("*")
    .eq("slug", slug)
    // A taken-down app isn't served anywhere: every route that loads the app through here treats it as gone.
    .is("suspended_at", null);
  if (!preview) query = query.eq("status", "published");
  const { data: app, error } = await query.maybeSingle();

  if (error) throw error;
  if (!app) return null;

  const { data: pages, error: pagesError } = await admin
    .from("pages")
    .select("*")
    .eq("app_id", app.id)
    .order("position", { ascending: true });

  if (pagesError) throw pagesError;

  return { app, pages: pages ?? [], preview };
});

/**
 * Resolves the optional catch-all path segments from
 * `app/published-apps/[appSlug]/[[...path]]/page.tsx` to a page row: `[]` (the app
 * root) resolves to the `is_home` page, anything else matches `pages.path`
 * joined with `/`. Returns `null` if nothing matches — see `getPublishedApp`
 * for why this doesn't call `notFound()` itself.
 */
export function resolvePage(published: PublishedApp, pathSegments: string[] | undefined): PageRow | null {
  const joinedPath = (pathSegments ?? []).join("/");

  const page = joinedPath
    ? published.pages.find((p) => p.path === joinedPath)
    : published.pages.find((p) => p.is_home) ?? published.pages[0];

  return page ?? null;
}

export async function getBlocksForPage(pageId: string): Promise<BlockRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blocks")
    .select("*")
    .eq("page_id", pageId)
    .order("position", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
