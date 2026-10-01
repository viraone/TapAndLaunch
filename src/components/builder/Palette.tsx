import { BLOCK_TYPES, BLOCK_TYPE_LABELS } from "@/lib/builder/block-defaults";
import { Type, Image as ImageIcon, Video, ClipboardList, ShoppingBag, CalendarDays, Video as ZoomIcon, Palette as CanvaIcon, Mic, Fuel, Plus, UtensilsCrossed, Ticket } from "lucide-react";
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
  gas_directory: Fuel,
  food_directory: UtensilsCrossed,
  listing_directory: Mic,
  open_mic_signup: Ticket,
};

/** Each block gets its own accent so the palette reads as a set of tools,
 * not a list of identical buttons. */
const ACCENTS: Record<BlockType, string> = {
  text: "from-neutral-300 to-neutral-500 text-neutral-950",
  image: "from-sky-400 to-blue-500 text-white",
  video: "from-rose-400 to-red-500 text-white",
  contact_form: "from-amber-400 to-orange-500 text-amber-950",
  product_list: "from-emerald-400 to-green-500 text-emerald-950",
  event_calendar: "from-violet-400 to-purple-500 text-white",
  zoom_meeting: "from-blue-400 to-indigo-500 text-white",
  canva_embed: "from-fuchsia-400 to-pink-500 text-white",
  gas_directory: "from-teal-400 to-emerald-500 text-teal-950",
  food_directory: "from-orange-400 to-red-500 text-white",
  listing_directory: "from-orange-400 to-rose-500 text-white",
  open_mic_signup: "from-red-500 to-rose-600 text-white",
};

/**
 * Adds blocks by click rather than drag-from-palette. Reordering already-
 * placed blocks is the drag interaction (`SortableBlockItem`); a second,
 * cross-container drag source here would roughly double the dnd-kit wiring
 * for a rarer action (you add a block once, then reorder it many times).
 */
export function Palette({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="p-3">
      <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Add a block</p>
      <div className="grid grid-cols-2 gap-2">
        {BLOCK_TYPES.map((type) => {
          const Icon = ICONS[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              className="group relative flex flex-col items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-left transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.06] hover:shadow-lg hover:shadow-black/40 active:translate-y-0"
            >
              <span className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br shadow-md ${ACCENTS[type]}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-medium leading-tight text-neutral-200">{BLOCK_TYPE_LABELS[type]}</span>
              <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-white/10 text-neutral-300 opacity-0 transition group-hover:opacity-100">
                <Plus className="h-3 w-3" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
