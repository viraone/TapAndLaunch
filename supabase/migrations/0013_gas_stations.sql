-- GasPal: a live gas-price directory block. Station rows come from Google
-- Places API (New) `fuelOptions` (lib/gas/google.ts) — the same per-station
-- prices Google Maps shows — cached here per app so a busy area costs one
-- Google call an hour, not one per viewer. Drivers can also submit prices
-- from the published app; a user-submitted price overrides Google's until
-- Google reports something newer (see the price-update route).

create table public.gas_stations (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  -- Google's stable place id; null for stations added by hand / from OSM.
  google_place_id text,
  station_name text not null,
  brand text,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  price_regular numeric(6, 3),
  price_midgrade numeric(6, 3),
  price_premium numeric(6, 3),
  price_diesel numeric(6, 3),
  -- Per-grade "as of" timestamps, keyed regular/midgrade/premium/diesel, so
  -- the card can say "Updated 15m ago" for the grade being viewed.
  price_updated jsonb not null default '{}'::jsonb,
  -- Where the current prices came from: 'google' | 'user' | null (no prices).
  price_source text check (price_source is null or price_source in ('google', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, google_place_id)
);

create index gas_stations_app_id_idx on public.gas_stations(app_id);

create trigger gas_stations_set_updated_at
  before update on public.gas_stations
  for each row execute function public.set_updated_at();

alter table public.gas_stations enable row level security;

create policy "org members can read their apps' gas stations"
  on public.gas_stations for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can write their apps' gas stations"
  on public.gas_stations for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

-- The cache ledger: one row per ~1-mile grid cell an app has fetched from
-- Google, with when. lib/gas/nearby.ts skips Google while a cell is fresh.
-- Service-role only (RLS on, no policies) — never read or written by the
-- dashboard.
create table public.gas_fetch_cells (
  app_id uuid not null references public.apps(id) on delete cascade,
  cell_key text not null,
  fetched_at timestamptz not null default now(),
  primary key (app_id, cell_key)
);

alter table public.gas_fetch_cells enable row level security;

-- Daily Google-call budget per app, so a bug or a bot can't run up a bill.
create table public.gas_fetch_budget (
  app_id uuid not null references public.apps(id) on delete cascade,
  day date not null,
  calls integer not null default 0,
  primary key (app_id, day)
);

alter table public.gas_fetch_budget enable row level security;

-- New block type.
alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory'
  ));
