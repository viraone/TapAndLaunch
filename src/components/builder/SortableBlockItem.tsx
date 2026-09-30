import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, Trash2 } from "lucide-react";
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
      className={`group relative cursor-pointer border-b border-border/60 transition last:border-b-0 ${
        selected
          ? "ring-2 ring-inset ring-indigo-500 shadow-[inset_0_0_0_9999px_rgba(99,102,241,0.04)]"
          : "hover:shadow-[inset_0_0_0_9999px_rgba(99,102,241,0.05)] hover:ring-1 hover:ring-inset hover:ring-indigo-400/50"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="pointer-events-none">
        <BlockRenderer block={block} />
      </div>
      {block.minTier && (
        <div
          className="absolute left-1 top-1 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm"
          title={block.minTier === "*" ? "Members only" : `Requires tier: ${block.minTier}`}
        >
          <Lock className="h-3 w-3" />
          {block.minTier === "*" ? "Members" : block.minTier}
        </div>
      )}
      <div className={`absolute right-1.5 top-1.5 flex gap-1 transition ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="grid h-6 w-6 cursor-grab place-items-center rounded-md bg-neutral-950 text-neutral-200 shadow-md active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md bg-neutral-950 text-neutral-200 shadow-md hover:bg-red-600 hover:text-white"
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
