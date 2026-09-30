import { TextBlockEditor } from "@/components/builder/blocks/TextBlockEditor";
import { ImageBlockEditor } from "@/components/builder/blocks/ImageBlockEditor";
import { VideoBlockEditor } from "@/components/builder/blocks/VideoBlockEditor";
import { ContactFormBlockEditor } from "@/components/builder/blocks/ContactFormBlockEditor";
import { ProductListBlockEditor } from "@/components/builder/blocks/ProductListBlockEditor";
import { EventCalendarBlockEditor } from "@/components/builder/blocks/EventCalendarBlockEditor";
import { ZoomMeetingBlockEditor } from "@/components/builder/blocks/ZoomMeetingBlockEditor";
import { CanvaEmbedBlockEditor } from "@/components/builder/blocks/CanvaEmbedBlockEditor";
import { ListingDirectoryBlockEditor } from "@/components/builder/blocks/ListingDirectoryBlockEditor";
import { GasDirectoryBlockEditor } from "@/components/builder/blocks/GasDirectoryBlockEditor";
import { BlockAccessControl } from "@/components/builder/BlockAccessControl";
import { MousePointerClick, SlidersHorizontal } from "lucide-react";
import { BLOCK_TYPE_LABELS } from "@/lib/builder/block-defaults";
import type { BlockConfig } from "@/types/database";
import type { BuilderBlock } from "@/components/builder/types";

export function Inspector({
  block,
  appId,
  organizationId,
  onChange,
  onMinTierChange,
}: {
  block: BuilderBlock | null;
  appId: string;
  organizationId: string;
  onChange: (config: BlockConfig) => void;
  onMinTierChange: (minTier: string | null) => void;
}) {
  if (!block) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-neutral-400">
          <MousePointerClick className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-neutral-200">Nothing selected</p>
        <p className="text-xs leading-relaxed text-neutral-500">
          Click a block on the phone to edit its content, or add one from the left.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-pink-400 text-neutral-950">
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Editing</p>
          <p className="text-sm font-medium text-neutral-100">{BLOCK_TYPE_LABELS[block.type]}</p>
        </div>
      </div>
      {block.type === "text" && (
        <TextBlockEditor config={block.config} onChange={onChange} />
      )}
      {block.type === "image" && (
        <ImageBlockEditor config={block.config} organizationId={organizationId} onChange={onChange} />
      )}
      {block.type === "video" && (
        <VideoBlockEditor config={block.config} onChange={onChange} />
      )}
      {block.type === "contact_form" && (
        <ContactFormBlockEditor config={block.config} onChange={onChange} />
      )}
      {block.type === "product_list" && (
        <ProductListBlockEditor config={block.config} appId={appId} onChange={onChange} />
      )}
      {block.type === "event_calendar" && (
        <EventCalendarBlockEditor config={block.config} appId={appId} onChange={onChange} />
      )}
      {block.type === "zoom_meeting" && (
        <ZoomMeetingBlockEditor config={block.config} onChange={onChange} />
      )}
      {block.type === "canva_embed" && (
        <CanvaEmbedBlockEditor config={block.config} onChange={onChange} />
      )}
      {block.type === "listing_directory" && (
        <ListingDirectoryBlockEditor config={block.config} onChange={onChange} />
      )}
      {block.type === "gas_directory" && (
        <GasDirectoryBlockEditor config={block.config} onChange={onChange} />
      )}
      <BlockAccessControl key={block.id} minTier={block.minTier} onChange={onMinTierChange} />
    </div>
  );
}
