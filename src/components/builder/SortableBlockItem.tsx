import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlockRenderer } from "@/components/pwa-runtime/BlockRenderer";
import type { BuilderBlock } from "@/components/builder/types";

export function SortableBlockItem({
  block,
  selected,
  onSelect,
  onRemove,
}: {
  block: BuilderBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative border-b last:border-b-0 ${
        selected ? "ring-2 ring-primary ring-inset" : ""
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="pointer-events-none">
        <BlockRenderer block={block} />
      </div>
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="rounded bg-background/90 p-1 shadow-sm"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background/90 shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
