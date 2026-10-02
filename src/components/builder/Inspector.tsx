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
import { FoodDirectoryBlockEditor } from "@/components/builder/blocks/FoodDirectoryBlockEditor";
import { OpenMicSignupBlockEditor } from "@/components/builder/blocks/OpenMicSignupBlockEditor";
import { BlockAccessControl } from "@/components/builder/BlockAccessControl";
import { GetLiveChecklist } from "@/components/builder/GetLiveChecklist";
import type { Checklist, ChecklistStepId } from "@/lib/apps/checklist";
import { GripVertical, MousePointerClick, X } from "lucide-react";
import { BLOCK_ACCENTS, BLOCK_ICONS } from "@/components/builder/blockMeta";
import { BLOCK_TYPE_LABELS } from "@/lib/builder/block-defaults";
import type { BlockConfig } from "@/types/database";
import type { BuilderBlock } from "@/components/builder/types";

export function Inspector({
  block,
  appId,
  organizationId,
  onChange,
  onMinTierChange,
  pageName,
  blocks,
  onSelect,
  onClose,
  checklist,
  liveUrl,
  publishing,
  onChecklistAction,
}: {
  block: BuilderBlock | null;
  pageName: string;
  /** This page's blocks, for the outline shown when nothing is selected. */
  blocks: BuilderBlock[];
  onSelect: (blockId: string) => void;
  onClose: () => void;
  checklist: Checklist;
  liveUrl: string | null;
  publishing: boolean;
  onChecklistAction: (step: ChecklistStepId) => void;
  appId: string;
  organizationId: string;
  onChange: (config: BlockConfig) => void;
  onMinTierChange: (minTier: string | null) => void;
}) {
  if (!block) {
    return (
      <div className="flex flex-col gap-5 p-4">
        <GetLiveChecklist checklist={checklist} liveUrl={liveUrl} busy={publishing} onAction={onChecklistAction} />
        <div>
          <p className="text-sm font-semibold text-neutral-100">{pageName}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {blocks.length ? `${blocks.length} block${blocks.length === 1 ? "" : "s"} on this page. Pick one to edit it.` : "No blocks yet."}
          </p>
        </div>
        {blocks.length ? (
          <ol className="space-y-1.5">
            {blocks.map((b, i) => {
              const Icon = BLOCK_ICONS[b.type];
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(b.id)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.06]"
                  >
                    <span className="w-4 text-center text-[11px] font-semibold tabular-nums text-neutral-500">{i + 1}</span>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${BLOCK_ACCENTS[b.type]}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-100">{BLOCK_TYPE_LABELS[b.type]}</span>
                    <GripVertical className="h-4 w-4 text-neutral-600 transition group-hover:text-neutral-400" />
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-neutral-400">
              <MousePointerClick className="h-5 w-5" />
            </span>
            <p className="text-xs leading-relaxed text-neutral-500">Add a block from the library on the left to start this page.</p>
          </div>
        )}
        <p className="rounded-2xl bg-white/[0.03] p-3 text-[11px] leading-relaxed text-neutral-500">
          Tip: drag blocks on the phone to reorder them. Save changes when you&apos;re done.
        </p>
      </div>
    );
  }

  const Icon = BLOCK_ICONS[block.type];
  return (
    <div className="space-y-5 p-4">
      <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br shadow-md ${BLOCK_ACCENTS[block.type]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Editing</p>
          <p className="truncate text-sm font-semibold text-neutral-100">{BLOCK_TYPE_LABELS[block.type]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 place-items-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
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
      {block.type === "food_directory" && (
        <FoodDirectoryBlockEditor config={block.config} onChange={onChange} />
      )}
      {block.type === "open_mic_signup" && (
        <OpenMicSignupBlockEditor config={block.config} onChange={onChange} />
      )}
      <BlockAccessControl key={block.id} minTier={block.minTier} onChange={onMinTierChange} />
    </div>
  );
}
