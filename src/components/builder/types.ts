import type {
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

/**
 * Discriminated union (keyed by `type`) so `block.type === "text"` narrows
 * `block.config` to `TextBlockConfig`, etc. The database row's `config`
 * column is just `jsonb` typed loosely as `BlockConfig` — this is the
 * builder-local shape used while editing.
 *
 * `minTier` is access gating (Phase 3): `null` = public, `"*"` = any
 * signed-in member, anything else = an exact `app_members.tier` match. See
 * the migration comment on `blocks.min_tier`.
 */
export type BuilderBlock =
  | { id: string; type: "text"; config: TextBlockConfig; minTier: string | null }
  | { id: string; type: "image"; config: ImageBlockConfig; minTier: string | null }
  | { id: string; type: "video"; config: VideoBlockConfig; minTier: string | null }
  | { id: string; type: "contact_form"; config: ContactFormBlockConfig; minTier: string | null }
  | { id: string; type: "product_list"; config: ProductListBlockConfig; minTier: string | null }
  | { id: string; type: "event_calendar"; config: EventCalendarBlockConfig; minTier: string | null }
  | { id: string; type: "zoom_meeting"; config: ZoomMeetingBlockConfig; minTier: string | null }
  | { id: string; type: "canva_embed"; config: CanvaEmbedBlockConfig; minTier: string | null }
  | { id: string; type: "listing_directory"; config: ListingDirectoryBlockConfig; minTier: string | null }
  | { id: string; type: "gas_directory"; config: GasDirectoryBlockConfig; minTier: string | null }
  | { id: string; type: "food_directory"; config: FoodDirectoryBlockConfig; minTier: string | null }
  | { id: string; type: "open_mic_signup"; config: OpenMicSignupBlockConfig; minTier: string | null };
