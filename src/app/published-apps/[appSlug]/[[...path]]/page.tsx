import { notFound } from "next/navigation";
import { getBlocksForPage, getPublishedApp, resolvePage } from "@/lib/pwa/data";
import { BlockRenderer } from "@/components/pwa-runtime/BlockRenderer";
import { GatedPlaceholder } from "@/components/pwa-runtime/GatedPlaceholder";
import { recordAnalyticsEvent } from "@/lib/pwa/analytics";
import { getCurrentMember, memberSatisfiesTier } from "@/lib/pwa/get-current-member";

// See the note in `../layout.tsx` on why `params` is typed by hand here
// instead of via the generated `PageProps<'/published-apps/[appSlug]/[[...path]]'>`
// helper.
type Params = Promise<{ appSlug: string; path?: string[] }>;

export default async function PublishedAppPage({ params }: { params: Params }) {
  const { appSlug, path } = await params;

  const published = await getPublishedApp(appSlug);
  if (!published) notFound();

  const page = resolvePage(published, path);
  if (!page) notFound();

  const blocks = await getBlocksForPage(page.id);
  const member = await getCurrentMember(published.app.id);
  const currentPath = `/${(path ?? []).join("/")}`;

  // Fire-and-forget: a page view should never block or fail the render.
  void recordAnalyticsEvent({ appId: published.app.id, pageId: page.id, eventType: "view" });

  return (
    <main className="flex-1">
      {blocks.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          This page has no content yet.
        </p>
      ) : (
        blocks.map((block) =>
          memberSatisfiesTier(member, block.min_tier) ? (
            <BlockRenderer key={block.id} block={block} pageId={page.id} />
          ) : (
            <GatedPlaceholder key={block.id} signedIn={!!member} next={currentPath} />
          )
        )
      )}
    </main>
  );
}
