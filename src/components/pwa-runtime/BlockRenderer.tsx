import type {
  BlockConfig,
  BlockType,
  CanvaEmbedBlockConfig,
  ClassFinderBlockConfig,
  ContactFormBlockConfig,
  EventCalendarBlockConfig,
  FoodDirectoryBlockConfig,
  GasDirectoryBlockConfig,
  ImageBlockConfig,
  ListingDirectoryBlockConfig,
  OpenMicSignupBlockConfig,
  ProductListBlockConfig,
  TextBlockConfig,
  VideoBlockConfig,
  ZoomMeetingBlockConfig,
  HeroBlockConfig,
  PriceListBlockConfig,
  HoursBlockConfig,
  ReviewsBlockConfig,
  StatsBlockConfig,
  GalleryBlockConfig,
  FilesBlockConfig,
  ButtonBlockConfig,
  QuoteBlockConfig,
  FaqBlockConfig,
  ImageTextBlockConfig,
  NewsletterBlockConfig,
  ShareBlockConfig,
  MapBlockConfig,
  AudioBlockConfig,
} from "@/types/database";
import { GalleryBlockView, HeroBlockView, HoursBlockView, PriceListBlockView, ReviewsBlockView, StatsBlockView } from "@/components/pwa-runtime/ShowcaseBlocks";
import { FilesBlockView } from "@/components/pwa-runtime/FilesBlock";
import { ButtonBlockView, FaqBlockView, QuoteBlockView } from "@/components/pwa-runtime/ExtraBlocks";
import { AudioBlockView, ImageTextBlockView, MapBlockView, NewsletterBlockView, ShareBlockView } from "@/components/pwa-runtime/MoreBlocks";
import { EditableImage, EditableText, PromoteHeading } from "@/components/pwa-runtime/Editable";
import { ContactFormRuntime } from "@/components/pwa-runtime/ContactFormRuntime";
import { ProductBuyRuntime, type RuntimeProduct } from "@/components/pwa-runtime/ProductBuyRuntime";
import { EventBookRuntime, type RuntimeEvent } from "@/components/pwa-runtime/EventBookRuntime";
import { GasDirectoryRuntime } from "@/components/pwa-runtime/GasDirectoryRuntime";
import { FoodDirectoryPreview, FoodDirectoryRuntime } from "@/components/pwa-runtime/FoodDirectoryRuntime";
import { ListingDirectoryRuntime } from "@/components/pwa-runtime/ListingDirectoryRuntime";
import { OpenMicSignupRuntime } from "@/components/pwa-runtime/OpenMicSignupRuntime";
import { ClassFinderRuntime } from "@/components/pwa-runtime/ClassFinderRuntime";
import type { RuntimeListing } from "@/lib/pwa/listings";

/**
 * Minimal shape needed to render a block — deliberately not the full
 * `blocks` table row, so this same component works for a persisted DB row
 * (the PWA runtime) and an in-progress builder block that has no `id`/
 * `position`/timestamps yet.
 */
export interface RenderableBlock {
  type: BlockType;
  config: BlockConfig;
}

/**
 * Renders a single block for its `type`. Shared between the published-PWA
 * runtime (server-rendered, read-only) and the builder's live preview pane
 * (client-rendered, read-only view *inside* a draggable wrapper) so the two
 * never visually drift apart.
 */
/** Looks every section can have: a background, and which screens show it. Stored on the section's config. */
export interface SectionOptions {
  appearance?: "plain" | "tinted" | "accent";
  show_on?: "all" | "phone" | "desktop";
}

const APPEARANCE: Record<string, string> = { tinted: "bg-muted/60", accent: "bg-primary/10" };
const SHOW_ON: Record<string, string> = { phone: "lg:hidden", desktop: "hidden lg:block" };

export function BlockRenderer(props: {
  block: RenderableBlock;
  pageId?: string;
  products?: RuntimeProduct[];
  events?: RuntimeEvent[];
  listings?: RuntimeListing[];
  /** "h1" for the one section whose heading is the page's main heading (lib/pwa/seo.ts picks it); others are h2. */
  headingLevel?: "h1" | "h2";
}) {
  const options = props.block.config as SectionOptions;
  const live = props.pageId !== undefined;
  // On the published site a phone-only section is hidden on wide screens (and the reverse); in the builder it stays
  // visible with a badge, so it can still be edited. Every section is wrapped and named (`data-block-type`) so a
  // look can style it from globals.css; on the published site it also reveals as it scrolls in (RevealObserver).
  const classes = [APPEARANCE[options.appearance ?? ""], live ? SHOW_ON[options.show_on ?? ""] : ""].filter(Boolean).join(" ");
  return (
    <div className={classes || undefined} data-block-type={props.block.type} {...(live ? { "data-reveal": "" } : {})}>
      <PromoteHeading on={props.headingLevel === "h1"}>
        <BlockBody {...props} />
      </PromoteHeading>
    </div>
  );
}

function BlockBody({
  block,
  pageId,
  products,
  events,
  listings,
}: {
  block: RenderableBlock;
  pageId?: string;
  /** Only passed by the published-app runtime (`page.tsx` fetches once per
   * page and shares it across every `product_list` block on it — there's
   * only ever one "set" to show, see `ProductListBlockConfig`). Undefined
   * in the builder, where this block instead shows a static placeholder. */
  products?: RuntimeProduct[];
  /** Same idea as `products`, for `event_calendar` blocks. */
  events?: RuntimeEvent[];
  /** Same idea as `products`, for `listing_directory` blocks. */
  listings?: RuntimeListing[];
}) {
  // The builder never passes `pageId`; the published runtime always does.
  const live = pageId !== undefined;
  switch (block.type) {
    case "text":
      return <TextBlockView config={block.config as TextBlockConfig} live={live} />;
    case "image":
      return <ImageBlockView config={block.config as ImageBlockConfig} live={live} />;
    case "video":
      return <VideoBlockView config={block.config as VideoBlockConfig} live={live} />;
    case "contact_form":
      return <ContactFormRuntime config={block.config as ContactFormBlockConfig} pageId={pageId} />;
    case "product_list":
      return <ProductListBlockView config={block.config as ProductListBlockConfig} products={products} />;
    case "event_calendar":
      return <EventCalendarBlockView config={block.config as EventCalendarBlockConfig} events={events} />;
    case "zoom_meeting":
      return <ZoomMeetingBlockView config={block.config as ZoomMeetingBlockConfig} />;
    case "canva_embed":
      return <CanvaEmbedBlockView config={block.config as CanvaEmbedBlockConfig} />;
    case "listing_directory":
      return <ListingDirectoryBlockView config={block.config as ListingDirectoryBlockConfig} listings={listings} />;
    case "gas_directory":
      return <GasDirectoryBlockView config={block.config as GasDirectoryBlockConfig} live={live} />;
    case "food_directory":
      return <FoodDirectoryBlockView config={block.config as FoodDirectoryBlockConfig} live={live} />;
    case "open_mic_signup":
      return live ? (
        <OpenMicSignupRuntime config={block.config as OpenMicSignupBlockConfig} />
      ) : (
        <OpenMicSignupBlockView config={block.config as OpenMicSignupBlockConfig} />
      );
    case "class_finder":
      return live ? <ClassFinderRuntime config={block.config as ClassFinderBlockConfig} /> : <ClassFinderBlockView config={block.config as ClassFinderBlockConfig} />;
    case "hero":
      return <HeroBlockView config={block.config as HeroBlockConfig} live={live} />;
    case "price_list":
      return <PriceListBlockView config={block.config as PriceListBlockConfig} live={live} />;
    case "hours":
      return <HoursBlockView config={block.config as HoursBlockConfig} live={live} />;
    case "reviews":
      return <ReviewsBlockView config={block.config as ReviewsBlockConfig} live={live} />;
    case "stats":
      return <StatsBlockView config={block.config as StatsBlockConfig} live={live} />;
    case "gallery":
      return <GalleryBlockView config={block.config as GalleryBlockConfig} live={live} />;
    case "files":
      return <FilesBlockView config={block.config as FilesBlockConfig} live={live} />;
    case "button":
      return <ButtonBlockView config={block.config as ButtonBlockConfig} live={live} />;
    case "quote":
      return <QuoteBlockView config={block.config as QuoteBlockConfig} live={live} />;
    case "faq":
      return <FaqBlockView config={block.config as FaqBlockConfig} live={live} />;
    case "image_text":
      return <ImageTextBlockView config={block.config as ImageTextBlockConfig} live={live} />;
    case "newsletter":
      return <NewsletterBlockView config={block.config as NewsletterBlockConfig} live={live} />;
    case "share":
      return <ShareBlockView config={block.config as ShareBlockConfig} live={live} />;
    case "map":
      return <MapBlockView config={block.config as MapBlockConfig} live={live} />;
    case "audio":
      return <AudioBlockView config={block.config as AudioBlockConfig} live={live} />;
    default:
      return <UnknownBlockView type={block.type} />;
  }
}

function TextBlockView({ config, live }: { config: TextBlockConfig; live: boolean }) {
  if (live && !config.heading && !config.body) return null;
  return (
    <div className="px-4 py-3 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-8">
      <EditableText as="h2" path={["heading"]} value={config.heading} placeholder="Heading" className="text-lg font-semibold @lg:text-3xl @lg:tracking-tight" />
      <EditableText as="div" path={["body"]} value={config.body} placeholder="Write something here" rich className="mt-1 text-sm text-muted-foreground @lg:mt-3 @lg:text-[17px] @lg:leading-relaxed" />
    </div>
  );
}

function ImageBlockView({ config, live }: { config: ImageBlockConfig; live: boolean }) {
  if (!config.src) {
    // Visitors of the live app see nothing for an image that was never set;
    // the placeholder is for the builder only.
    if (live) return null;
    return (
      <div className="mx-4 flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No image set
      </div>
    );
  }
  const focus = config.focus && config.focus !== "center" ? ({ objectPosition: config.focus } as React.CSSProperties) : undefined;
  return (
    <figure className="@lg:mx-auto @lg:my-6 @lg:max-w-4xl">
      <EditableImage path={["src"]} src={config.src} alt={config.alt ?? ""} className="w-full object-cover @lg:rounded-3xl" imgClassName="w-full object-cover" style={focus} />
      {(config.caption || !live) && <EditableText as="figcaption" path={["caption"]} value={config.caption} placeholder="A line under the picture (optional)" className="mt-2 px-4 text-center text-sm text-muted-foreground @lg:px-0" />}
    </figure>
  );
}

function VideoBlockView({ config, live }: { config: VideoBlockConfig; live: boolean }) {
  if (!config.url) {
    // A starter can ship an empty video (a photographer's reel to come); visitors never see the hint.
    if (live) return null;
    return (
      <div className="mx-4 flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No video set
      </div>
    );
  }

  const embedSrc = toEmbedUrl(config);

  return (
    <div className="aspect-video w-full @lg:mx-auto @lg:my-6 @lg:max-w-4xl @lg:overflow-hidden @lg:rounded-3xl">
      <iframe
        src={embedSrc}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function toEmbedUrl(config: VideoBlockConfig): string {
  const url = config.url ?? "";
  if (config.provider === "youtube") {
    const id = extractYoutubeId(url);
    return id ? `https://www.youtube.com/embed/${id}` : url;
  }
  if (config.provider === "vimeo") {
    const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : url;
  }
  return url;
}

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function ProductListBlockView({
  config,
  products,
}: {
  config: ProductListBlockConfig;
  products?: RuntimeProduct[];
}) {
  return (
    <div className="px-4 py-3 @lg:mx-auto @lg:max-w-5xl @lg:px-8 @lg:py-8">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Shop" className="mb-2 text-lg font-semibold @lg:mb-5 @lg:text-3xl @lg:tracking-tight" />
      {products === undefined ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Shows every active product when published.
        </p>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3 @lg:gap-5 @5xl:grid-cols-4">
          {products.map((product) => (
            <ProductBuyRuntime key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCalendarBlockView({
  config,
  events,
}: {
  config: EventCalendarBlockConfig;
  events?: RuntimeEvent[];
}) {
  return (
    <div className="px-4 py-3 @lg:mx-auto @lg:max-w-4xl @lg:px-8 @lg:py-8">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Upcoming events" className="mb-2 text-lg font-semibold @lg:mb-5 @lg:text-3xl @lg:tracking-tight" />
      {events === undefined ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Shows every upcoming event when published.
        </p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming events.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @lg:gap-5">
          {events.map((event) => (
            <EventBookRuntime key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function ZoomMeetingBlockView({ config }: { config: ZoomMeetingBlockConfig }) {
  return (
    <div className="mx-4 my-2 space-y-2 rounded-md border p-4">
      <EditableText as="h3" path={["title"]} value={config.title} placeholder="Join our meeting" className="font-medium" />
      <EditableText as="div" path={["description"]} value={config.description} placeholder="A line about it" rich className="text-sm text-muted-foreground" />
      {config.meeting_url ? (
        <a
          href={config.meeting_url}
          target="_blank"
          rel="noreferrer"
          className="block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
        >
          Join meeting
        </a>
      ) : (
        <p className="text-sm text-muted-foreground italic">No meeting URL set</p>
      )}
    </div>
  );
}

function CanvaEmbedBlockView({ config }: { config: CanvaEmbedBlockConfig }) {
  if (!config.embed_url && !config.button_url) {
    return (
      <div className="mx-4 flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No Canva embed or link set
      </div>
    );
  }

  return (
    <div className="mx-4 my-2 space-y-2">
      {config.embed_url && (
        <div className="aspect-video w-full overflow-hidden rounded-md border">
          <iframe src={config.embed_url} className="h-full w-full" allow="fullscreen" allowFullScreen />
        </div>
      )}
      {config.button_url && (
        <a
          href={config.button_url}
          target="_blank"
          rel="noreferrer"
          className="block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
        >
          {config.button_label || "Open in Canva"}
        </a>
      )}
    </div>
  );
}

/** On a published page, today's open mics (worked out in the browser by
 * ListingDirectoryRuntime); in the builder, which passes no listings, a
 * placeholder. */
function ListingDirectoryBlockView({
  config,
  listings,
}: {
  config: ListingDirectoryBlockConfig;
  listings?: RuntimeListing[];
}) {
  return (
    <div className="px-4 py-3">
      {config.title && <h2 className="mb-2 text-lg font-semibold">{config.title}</h2>}
      {listings === undefined ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Shows the open mics happening today when published.
        </p>
      ) : (
        <ListingDirectoryRuntime listings={listings} />
      )}
    </div>
  );
}

function GasDirectoryBlockView({ config, live }: { config: GasDirectoryBlockConfig; live: boolean }) {
  if (!live) {
    return (
      <div className="px-4 py-3">
        {config.title && <h2 className="mb-2 text-lg font-semibold">{config.title}</h2>}
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Live gas prices around each viewer&rsquo;s location when published (within {config.radius_miles ?? 2} mi).
        </p>
      </div>
    );
  }
  return <GasDirectoryRuntime config={config} />;
}

function FoodDirectoryBlockView({ config, live }: { config: FoodDirectoryBlockConfig; live: boolean }) {
  if (!live) return <FoodDirectoryPreview config={config} />;
  return <FoodDirectoryRuntime config={config} />;
}

function ClassFinderBlockView({ config }: { config: ClassFinderBlockConfig }) {
  return (
    <div className="px-4 py-3">
      <h2 className="text-lg font-semibold">{config.title || "FitnessNav"}</h2>
      {config.subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{config.subtitle}</p>}
      <p className="mt-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Viewers pick class types (Pilates, yoga, spin, lifting, climbing) and a day, and see every class at nearby
        studios on one page when published. Schedules are read each morning from the studios&apos; own sites.
      </p>
    </div>
  );
}

function OpenMicSignupBlockView({ config }: { config: OpenMicSignupBlockConfig }) {
  return (
    <div className="px-4 py-3">
      <h2 className="text-lg font-semibold">{config.show_name || config.title || "Open mic sign-up"}</h2>
      <p className="mt-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Comedians sign in with an emailed code and request a spot for the next show
        {config.supabase_url ? "." : " (connect a Supabase project in the inspector)."}
      </p>
    </div>
  );
}

function UnknownBlockView({ type }: { type: string }) {
  return (
    <div className="mx-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      Unsupported block type: {type}
    </div>
  );
}

export type { BlockConfig };
