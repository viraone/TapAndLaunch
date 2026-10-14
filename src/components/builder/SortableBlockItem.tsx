import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Copy, GripVertical, Lock, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlockRenderer } from "@/components/pwa-runtime/BlockRenderer";
import { BlockEditContext } from "@/components/pwa-runtime/Editable";
import { setAt } from "@/lib/builder/set-at";
import { createClient } from "@/lib/supabase/client";
import { uploadAppAsset } from "@/lib/storage/upload";
import type { BuilderBlock } from "@/components/builder/types";
import type { BlockConfig } from "@/types/database";

export function SortableBlockItem({
  block,
  selected,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onChange,
  organizationId,
}: {
  block: BuilderBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  /** Up and down one place; absent at the top or bottom. Easier than dragging on a trackpad. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate: () => void;
  /** The section's words, edited in place on the page, come back through here like the inspector's changes. */
  onChange: (config: BlockConfig) => void;
  /** Whose storage folder a replaced photo goes to. */
  organizationId: string;
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
      data-block-id={block.id}
      onClick={onSelect}
      className={`group relative cursor-pointer border-b border-border/60 transition last:border-b-0 ${
        selected
          ? "ring-2 ring-inset ring-indigo-500 shadow-[inset_0_0_0_9999px_rgba(99,102,241,0.04)]"
          : "hover:shadow-[inset_0_0_0_9999px_rgba(99,102,241,0.05)] hover:ring-1 hover:ring-inset hover:ring-indigo-400/50"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      {/* Links and buttons inside a section stay inert in the builder; its words are the exception (`EditableText`). */}
      <div className="pointer-events-none">
        <BlockEditContext.Provider
          value={{
            set: (path, value) => onChange(setAt(block.config, path, value)),
            upload: (file) => uploadAppAsset(createClient(), organizationId, file),
          }}
        >
          <BlockRenderer block={block} />
        </BlockEditContext.Provider>
      </div>
      {/* Says what a tap does, the moment the pointer is over a section. Nothing on the phone looked clickable before. */}
      {!selected && (
        <span
          aria-hidden
          className={`pointer-events-none absolute left-1.5 ${block.minTier ? "top-7" : "top-1.5"} inline-flex items-center gap-1 rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md opacity-0 transition group-hover:opacity-100`}
        >
          <Pencil className="h-3 w-3" /> Click the words to change them
        </span>
      )}
      {(block.config as { show_on?: string }).show_on && (block.config as { show_on?: string }).show_on !== "all" && (
        <div className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm">
          {(block.config as { show_on?: string }).show_on === "phone" ? "Phones only" : "Computers only"}
        </div>
      )}
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
        {([
          ["Move up", ChevronUp, onMoveUp],
          ["Move down", ChevronDown, onMoveDown],
          ["Duplicate section", Copy, onDuplicate],
        ] as const).map(([label, Icon, handler]) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            disabled={!handler}
            onClick={(e) => {
              e.stopPropagation();
              handler?.();
            }}
            className="grid h-6 w-6 place-items-center rounded-md bg-neutral-950 text-neutral-200 shadow-md transition hover:bg-neutral-800 disabled:opacity-30"
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="grid h-6 w-6 cursor-grab place-items-center rounded-md bg-neutral-950 text-neutral-200 shadow-md active:cursor-grabbing"
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Remove section"
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
