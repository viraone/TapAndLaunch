-- LiveBites: the restaurant's menu as items (sections, dishes, prices, descriptions), shown in the app's own
-- menu screen. Filled by the menu job that runs on the owner's Mac (tools/menu-ingest): a real browser opens the
-- restaurant's menu page, a local model reads it, and anything not found on the page is thrown away. The app only
-- reads these columns; if a restaurant has no saved menu it falls back to showing the restaurant's own website.
-- Additive and nullable.

alter table public.food_places
  add column if not exists menu_items jsonb,            -- { "sections": [ { "name", "items": [ { "name", "price", "description" } ] } ] }
  add column if not exists menu_items_source_url text,  -- the page the menu was read from
  add column if not exists menu_items_at timestamptz,   -- when the job last tried (also set for misses, so it doesn't retry for a while)
  add column if not exists menu_items_status text,      -- ok | not_menu | unreliable | unreadable | pdf | blocked_robots | error
  add column if not exists menu_items_model text;       -- which local model read it
