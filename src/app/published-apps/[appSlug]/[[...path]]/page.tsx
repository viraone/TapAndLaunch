import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getCodeAppsDomain, hostRoot } from "@/lib/tenant";
import { appOrigin } from "@/lib/stripe/checkout";
import { getBlocksForPage, getPublishedApp, resolvePage } from "@/lib/pwa/data";
import { getActiveProducts, getUpcomingEvents } from "@/lib/pwa/commerce";
import { getActiveListings } from "@/lib/pwa/listings";
import { BlockRenderer } from "@/components/pwa-runtime/BlockRenderer";
import { GatedPlaceholder } from "@/components/pwa-runtime/GatedPlaceholder";
import { recordAnalyticsEvent } from "@/lib/pwa/analytics";
import { CodeAppFrame } from "@/components/pwa-runtime/CodeAppFrame";
import { getCurrentMember, memberSatisfiesTier } from "@/lib/pwa/get-current-member";
import { pageTitle } from "@/lib/pwa/page-title";
import { canonicalOrigin, firstHeadedBlockIndex, pageJsonLd, publishedPageMetadata } from "@/lib/pwa/seo";
import { jsonLdText } from "@/lib/marketing";

// See the note in `../layout.tsx` on why `params` is typed by hand here
// instead of via the generated `PageProps<'/published-apps/[appSlug]/[[...path]]'>`
// helper.
type Params = Promise<{ appSlug: string; path?: string[] }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * A page's title, description, one canonical address and share card for search engines and link previews. The
 * page's own SEO fields win; the rest is worked out from the app and the page's first words (lib/pwa/seo.ts).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { appSlug, path } = await params;
  const published = await getPublishedApp(appSlug);
  if (!published || published.app.kind === "code") return {};

  const page = resolvePage(published, path);
  if (!page) return {};

  const blocks = await getBlocksForPage(page.id);
  const origin = canonicalOrigin(published.app, (await headers()).get("host"));
  return publishedPageMetadata(published.app, page, blocks, origin);
}

export default async function PublishedAppPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { appSlug, path } = await params;

  const published = await getPublishedApp(appSlug);
  if (!published) notFound();

  // An AI-written app (BYOB code mode) is one sandboxed page, served by ./app-code; it handles its own routing.
  if (published.app.kind === "code") {
    // AI-written apps live on their own domain once it's set up; their old address on TapAndLaunch's domain forwards there.
    const codeDomain = getCodeAppsDomain();
    if (codeDomain && hostRoot((await headers()).get("host")) === "main") redirect(`${appOrigin(appSlug, codeDomain)}/${(path ?? []).join("/")}`);
    if (!published.preview) void recordAnalyticsEvent({ appId: published.app.id, eventType: "view" });
    return <CodeAppFrame name={published.app.name} />;
  }

  const page = resolvePage(published, path);
  if (!page) notFound();
  // The owner can send home-page visitors somewhere else for a while (theme.home_redirect: StageTime -> the
  // Halloween costume contest sign-up on stagetimepnw.com). A 307, so the app is back as soon as the key is removed;
  // the builder's "Try it" preview still shows the page itself, and /lineup, /remote, /profile are untouched.
  const homeRedirect = published.app.theme?.home_redirect;
  if (page.is_home && !published.preview && homeRedirect && /^https?:\/\//.test(homeRedirect)) redirect(homeRedirect);
  // The home page has one address, "/": its path ("/home") forwards there, so search engines never see it twice.
  // The query string goes along (StageTime's "/signup?signout" test link, when Sign-Up is the home page).
  if (page.is_home && path?.length) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
    }
    const rest = query.toString();
    permanentRedirect(rest ? `/?${rest}` : "/");
  }

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

  // Fire-and-forget: a page view should never block or fail the render. The owner trying their app from the builder
  // is not a visitor, so that view is not counted (and does not tick the "someone opened it" step).
  if (!published.preview) void recordAnalyticsEvent({ appId: published.app.id, pageId: page.id, eventType: "view" });

  // The first section with a heading carries the page's <h1>; a page of photos or forms alone gets a hidden one.
  const mainHeadingAt = firstHeadedBlockIndex(blocks);
  const origin = canonicalOrigin(published.app, (await headers()).get("host"));

  return (
    <main className="flex-1">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdText(pageJsonLd(published.app, page, blocks, origin)) }} />
      {mainHeadingAt < 0 && <h1 className="sr-only">{pageTitle(published.app, page)}</h1>}
      {blocks.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          This page has no content yet.
        </p>
      ) : (
        blocks.map((block, index) =>
          memberSatisfiesTier(member, block.min_tier) ? (
            <BlockRenderer
              key={block.id}
              block={block}
              pageId={page.id}
              products={products}
              events={events}
              listings={listings}
              headingLevel={index === mainHeadingAt ? "h1" : undefined}
            />
          ) : (
            <GatedPlaceholder key={block.id} signedIn={!!member} next={currentPath} />
          )
        )
      )}
    </main>
  );
}
