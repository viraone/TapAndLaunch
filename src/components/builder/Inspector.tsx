import { TextBlockEditor } from "@/components/builder/blocks/TextBlockEditor";
import { ImageBlockEditor } from "@/components/builder/blocks/ImageBlockEditor";
import { VideoBlockEditor } from "@/components/builder/blocks/VideoBlockEditor";
import { ContactFormBlockEditor } from "@/components/builder/blocks/ContactFormBlockEditor";
import { BlockAccessControl } from "@/components/builder/BlockAccessControl";
import { BLOCK_TYPE_LABELS } from "@/lib/builder/block-defaults";
import type { BlockConfig } from "@/types/database";
import type { BuilderBlock } from "@/components/builder/types";

export function Inspector({
  block,
  organizationId,
  onChange,
  onMinTierChange,
}: {
  block: BuilderBlock | null;
  organizationId: string;
  onChange: (config: BlockConfig) => void;
  onMinTierChange: (minTier: string | null) => void;
}) {
  if (!block) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a block on the canvas to edit it.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">
          {BLOCK_TYPE_LABELS[block.type]}
        </p>
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
      <BlockAccessControl key={block.id} minTier={block.minTier} onChange={onMinTierChange} />
    </div>
  );
}
