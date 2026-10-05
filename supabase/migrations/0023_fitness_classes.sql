-- FitnessNav: one page with every group class (Pilates, yoga, spin, lifting, climbing) at nearby studios, by day.
-- Studios and their classes are read from each studio's own schedule page by a job on the owner's Mac every morning
-- (tools/class-ingest), which writes these tables with the service key. The published app only reads them, through
-- its /fitness/classes route (service-role client), so there are no public policies.

alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory', 'food_directory',
    'open_mic_signup', 'class_finder'
  ));

create table public.fitness_studios (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  google_place_id text,
  name text not null,
  -- What the studio mainly is (pilates / yoga / spin / lifting / climbing / other); a class's own name decides its type first.
  kind text not null default 'other',
  address text,
  neighborhood text,
  latitude double precision,
  longitude double precision,
  website text,
  -- The page the classes were read from (also where "Book" goes).
  schedule_url text,
  -- ok / no_schedule / blocked_robots / error, from the last morning run.
  read_status text,
  read_at timestamptz,
  class_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, name)
);

create index fitness_studios_app_id_idx on public.fitness_studios(app_id);

create trigger fitness_studios_set_updated_at
  before update on public.fitness_studios
  for each row execute function public.set_updated_at();

create table public.fitness_classes (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  studio_id uuid not null references public.fitness_studios(id) on delete cascade,
  -- The class's own day and Seattle-local times, as the studio lists them.
  class_date date not null,
  start_time time not null,
  end_time time,
  name text not null,
  instructor text,
  -- "3 spots left" / "Waitlist" / "Full", as the page said at read time.
  spots text,
  -- pilates / yoga / spin / lifting / climbing / other
  class_type text not null,
  -- Joined from home (livestream, "at HOME"); hidden unless the viewer asks for them.
  online boolean not null default false,
  read_at timestamptz not null default now()
);

create index fitness_classes_app_date_idx on public.fitness_classes(app_id, class_date);
create index fitness_classes_studio_idx on public.fitness_classes(studio_id);

alter table public.fitness_studios enable row level security;
alter table public.fitness_classes enable row level security;

create policy "org members can read their apps' fitness studios"
  on public.fitness_studios for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org members can read their apps' fitness classes"
  on public.fitness_classes for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));
