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
 */
export type BuilderBlock =
  | { id: string; type: "text"; config: TextBlockConfig }
  | { id: string; type: "image"; config: ImageBlockConfig }
  | { id: string; type: "video"; config: VideoBlockConfig }
  | { id: string; type: "contact_form"; config: ContactFormBlockConfig };
