-- LiveBites: vegan options read off the restaurant's own menu by the menu job (tools/menu-ingest), so a visitor
-- browsing any cuisine can see which places have something vegan. Additive: nothing existing changes.
alter table public.food_places
  add column if not exists vegan_options jsonb,            -- { "items": [ { "name", "section" | null, "note"? } ] }
  add column if not exists vegan_options_at timestamptz,   -- when the menu was last checked for vegan items
  add column if not exists vegan_options_status text;      -- found | none  (null = the menu has never been read)
