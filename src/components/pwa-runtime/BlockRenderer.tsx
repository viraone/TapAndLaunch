import type { BlockConfig, BlockType, ContactFormBlockConfig, ImageBlockConfig, TextBlockConfig, VideoBlockConfig } from "@/types/database";
import { ContactFormRuntime } from "@/components/pwa-runtime/ContactFormRuntime";

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
export function BlockRenderer({ block, pageId }: { block: RenderableBlock; pageId?: string }) {
  switch (block.type) {
    case "text":
      return <TextBlockView config={block.config as TextBlockConfig} />;
    case "image":
      return <ImageBlockView config={block.config as ImageBlockConfig} />;
    case "video":
      return <VideoBlockView config={block.config as VideoBlockConfig} />;
    case "contact_form":
      return <ContactFormRuntime config={block.config as ContactFormBlockConfig} pageId={pageId} />;
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

function UnknownBlockView({ type }: { type: string }) {
  return (
    <div className="mx-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      Unsupported block type: {type}
    </div>
  );
}

export type { BlockConfig };
