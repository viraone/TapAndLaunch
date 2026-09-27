import { Button } from "@/components/ui/button";
import { BLOCK_TYPES, BLOCK_TYPE_LABELS } from "@/lib/builder/block-defaults";
import { Type, Image as ImageIcon, Video, ClipboardList, ShoppingBag, CalendarDays, Video as ZoomIcon, Palette as CanvaIcon } from "lucide-react";
import type { BlockType } from "@/types/database";

const ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  text: Type,
  image: ImageIcon,
  video: Video,
  contact_form: ClipboardList,
  product_list: ShoppingBag,
  event_calendar: CalendarDays,
  zoom_meeting: ZoomIcon,
  canva_embed: CanvaIcon,
};

/**
 * Adds blocks by click rather than drag-from-palette. Reordering already-
 * placed blocks is the drag interaction (`SortableBlockItem`); a second,
 * cross-container drag source here would roughly double the dnd-kit wiring
 * for a rarer action (you add a block once, then reorder it many times).
 */
export function Palette({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="space-y-1 p-3">
      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Add block</p>
      {BLOCK_TYPES.map((type) => {
        const Icon = ICONS[type];
        return (
          <Button
            key={type}
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => onAdd(type)}
          >
            <Icon className="mr-2 h-4 w-4" />
            {BLOCK_TYPE_LABELS[type]}
          </Button>
        );
      })}
    </div>
  );
}
