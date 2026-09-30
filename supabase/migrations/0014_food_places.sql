-- LiveBites: a real-time local food directory block. Restaurant rows come
-- from Google Places API (New) — name, cuisine types, rating, and the full
-- weekly opening hours + UTC offset (lib/food/google.ts). Open / closing
-- soon / closed is *computed* from those hours at render time
-- (lib/food/hours.ts), so status stays live minute to minute while Google
-- is only asked once a day per grid cell. Wait times are crowd-sourced:
-- diners report them from the published app and each report is shown for
-- 90 minutes (see lib/food/nearby.ts).

create table public.food_places (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  google_place_id text not null,
  name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  -- Google's primaryType (e.g. 'ramen_restaurant') and full types list.
  primary_type text,
  types text[] not null default '{}',
  rating numeric(3, 2),
  rating_count integer,
  -- Google's PriceLevel enum as a 0–4 integer (null when unknown).
  price_level smallint,
  -- regularOpeningHours.periods, verbatim from Google:
  --   [{ open: { day, hour, minute }, close?: { day, hour, minute } }]
  opening_periods jsonb not null default '[]'::jsonb,
  -- regularOpeningHours.weekdayDescriptions, e.g. ["Monday: 11 AM – 9 PM", …]
  weekday_descriptions jsonb not null default '[]'::jsonb,
  -- The place's UTC offset in minutes, so hours can be evaluated in *its*
  -- local time regardless of where the server or viewer is.
  utc_offset_minutes integer,
  business_status text,
  google_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, google_place_id)
);

create index food_places_app_id_idx on public.food_places(app_id);

create trigger food_places_set_updated_at
  before update on public.food_places
  for each row execute function public.set_updated_at();

alter table public.food_places enable row level security;

create policy "org members can read their apps' food places"
  on public.food_places for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can write their apps' food places"
  on public.food_places for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

-- Crowd-sourced wait times. Append-only; the runtime shows the most recent
-- report per place from the last 90 minutes. Written only via the
-- service-role client from the published app's /food/wait route.
create table public.food_wait_reports (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  place_id uuid not null references public.food_places(id) on delete cascade,
  wait_minutes integer not null check (wait_minutes >= 0 and wait_minutes <= 240),
  reported_at timestamptz not null default now()
);

create index food_wait_reports_place_idx on public.food_wait_reports(place_id, reported_at desc);

alter table public.food_wait_reports enable row level security;

create policy "org members can read their apps' wait reports"
  on public.food_wait_reports for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

-- Cache ledger + daily Google budget, same shape as the gas tables.
-- Service-role only (RLS on, no policies).
create table public.food_fetch_cells (
  app_id uuid not null references public.apps(id) on delete cascade,
  cell_key text not null,
  fetched_at timestamptz not null default now(),
  primary key (app_id, cell_key)
);

alter table public.food_fetch_cells enable row level security;

create table public.food_fetch_budget (
  app_id uuid not null references public.apps(id) on delete cascade,
  day date not null,
  calls integer not null default 0,
  primary key (app_id, day)
);

alter table public.food_fetch_budget enable row level security;

-- New block type.
alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory', 'food_directory'
  ));
