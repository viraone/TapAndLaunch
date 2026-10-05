-- LiveBites: "Happy Hour" filter. Google has no happy hour data, so the menu job that runs on the owner's Mac
-- (tools/menu-ingest) reads it from the restaurant's own website: a local model pulls out the days, times and deal
-- wording, and anything whose times or words can't be found on the page is thrown away. The app only reads these columns.
-- Additive and nullable.

alter table public.food_places
  add column if not exists happy_hour jsonb,             -- { "windows": [ { "days": [1,2,3], "start": "16:00", "end": "18:00" | null (= until close), "deal": "$5 drafts" | null } ] }
  add column if not exists happy_hour_source_url text,   -- the page it was read from
  add column if not exists happy_hour_at timestamptz,    -- when the job last looked (also set when none was found, so it doesn't retry for a while)
  add column if not exists happy_hour_status text;       -- ok | none | unclear | error
