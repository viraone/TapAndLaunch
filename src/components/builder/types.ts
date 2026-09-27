import type {
  ContactFormBlockConfig,
  ImageBlockConfig,
  TextBlockConfig,
  VideoBlockConfig,
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
  | { id: string; type: "contact_form"; config: ContactFormBlockConfig; minTier: string | null };
