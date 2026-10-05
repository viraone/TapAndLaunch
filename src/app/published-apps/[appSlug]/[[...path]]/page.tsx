import { notFound } from "next/navigation";
import { getBlocksForPage, getPublishedApp, resolvePage } from "@/lib/pwa/data";
import { getActiveProducts, getUpcomingEvents } from "@/lib/pwa/commerce";
import { getActiveListings } from "@/lib/pwa/listings";
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

  // Fetched once per page, not per block: every `product_list`/
  // `event_calendar` block on a page shows the same "all active/upcoming"
  // set anyway (see BlockRenderer's comment), and most pages have none of
  // either, so skip the query entirely when there's nothing to feed it.
  const needsProducts = blocks.some((b) => b.type === "product_list");
  const needsEvents = blocks.some((b) => b.type === "event_calendar");
  const needsListings = blocks.some((b) => b.type === "listing_directory");
  const [products, events, listings] = await Promise.all([
    needsProducts ? getActiveProducts(published.app.id, published.app.organization_id) : Promise.resolve(undefined),
    needsEvents ? getUpcomingEvents(published.app.id) : Promise.resolve(undefined),
    needsListings ? getActiveListings(published.app.id) : Promise.resolve(undefined),
  ]);

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
            <BlockRenderer key={block.id} block={block} pageId={page.id} products={products} events={events} listings={listings} />
          ) : (
            <GatedPlaceholder key={block.id} signedIn={!!member} next={currentPath} />
          )
        )
      )}
    </main>
  );
}
