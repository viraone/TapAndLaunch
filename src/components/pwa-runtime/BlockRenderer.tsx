import type {
  BlockConfig,
  BlockType,
  CanvaEmbedBlockConfig,
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
} from "@/types/database";
import { ContactFormRuntime } from "@/components/pwa-runtime/ContactFormRuntime";
import { ProductBuyRuntime, type RuntimeProduct } from "@/components/pwa-runtime/ProductBuyRuntime";
import { EventBookRuntime, type RuntimeEvent } from "@/components/pwa-runtime/EventBookRuntime";
import { GasDirectoryRuntime } from "@/components/pwa-runtime/GasDirectoryRuntime";
import { FoodDirectoryRuntime } from "@/components/pwa-runtime/FoodDirectoryRuntime";
import { ListingDirectoryRuntime } from "@/components/pwa-runtime/ListingDirectoryRuntime";
import { OpenMicSignupRuntime } from "@/components/pwa-runtime/OpenMicSignupRuntime";
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
export function BlockRenderer({
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
      return <TextBlockView config={block.config as TextBlockConfig} />;
    case "image":
      return <ImageBlockView config={block.config as ImageBlockConfig} />;
    case "video":
      return <VideoBlockView config={block.config as VideoBlockConfig} />;
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
    default:
      return <UnknownBlockView type={block.type} />;
  }
}

function TextBlockView({ config }: { config: TextBlockConfig }) {
  return (
    <div className="px-4 py-3">
      {config.heading && <h2 className="text-lg font-semibold">{config.heading}</h2>}
      {config.body && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{config.body}</p>}
      {!config.heading && !config.body && (
        <p className="text-sm text-muted-foreground italic">Empty text block</p>
      )}
    </div>
  );
}

function ImageBlockView({ config }: { config: ImageBlockConfig }) {
  if (!config.src) {
    return (
      <div className="mx-4 flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No image set
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- source is arbitrary tenant-provided storage URLs
  return <img src={config.src} alt={config.alt ?? ""} className="w-full object-cover" />;
}

function VideoBlockView({ config }: { config: VideoBlockConfig }) {
  if (!config.url) {
    return (
      <div className="mx-4 flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No video set
      </div>
    );
  }

  const embedSrc = toEmbedUrl(config);

  return (
    <div className="aspect-video w-full">
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
    <div className="px-4 py-3">
      {config.title && <h2 className="mb-2 text-lg font-semibold">{config.title}</h2>}
      {products === undefined ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Shows every active product when published.
        </p>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
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
    <div className="px-4 py-3">
      {config.title && <h2 className="mb-2 text-lg font-semibold">{config.title}</h2>}
      {events === undefined ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Shows every upcoming event when published.
        </p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming events.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
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
      {config.title && <h3 className="font-medium">{config.title}</h3>}
      {config.description && <p className="text-sm text-muted-foreground">{config.description}</p>}
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
  if (!live) {
    return (
      <div className="px-4 py-3">
        {config.title && <h2 className="text-lg font-semibold">{config.title}</h2>}
        {config.subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{config.subtitle}</p>}
        <p className="mt-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Live open / closing-soon / closed status for restaurants around each viewer
          when published (within {config.radius_miles ?? 2} mi).
        </p>
      </div>
    );
  }
  return <FoodDirectoryRuntime config={config} />;
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
