-- Scheduling is private to each app: only the organization's editors
-- (admin/creator) can read or write these rows. A row in schedule_settings
-- means the app uses Scheduling.

create table public.schedule_settings (
  app_id uuid primary key references public.apps(id) on delete cascade,
  time_zone text not null default 'America/Los_Angeles',
  default_duration_minutes integer not null default 120 check (default_duration_minutes between 15 and 720),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.schedule_customers (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  email text,
  phone text,
  address text,
  entry_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index schedule_customers_app_name_idx
  on public.schedule_customers (app_id, lower(name));

create table public.schedule_series (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  customer_id uuid not null references public.schedule_customers(id) on delete cascade,
  starts_on date not null,
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 15 and 720),
  interval_weeks integer not null check (interval_weeks between 1 and 12),
  ends_on date,
  service text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index schedule_series_app_idx on public.schedule_series (app_id);

create table public.schedule_visits (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  customer_id uuid not null references public.schedule_customers(id) on delete cascade,
  series_id uuid references public.schedule_series(id) on delete set null,
  starts_at timestamptz not null,
  -- For a visit made by a repeat rule, the local date of the occurrence it
  -- stands for. It never changes when the owner later moves the visit, so a
  -- moved or cancelled occurrence is not created again at its old time.
  occurrence_on date,
  duration_minutes integer not null check (duration_minutes between 15 and 720),
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'reschedule_requested', 'cancelled', 'done')),
  service text,
  notes text,
  entry_instructions text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One visit per occurrence of a rule. One-off visits have nulls here, and
  -- Postgres treats nulls as distinct, so they never conflict with each other.
  unique (series_id, occurrence_on)
);

create index schedule_visits_app_starts_idx
  on public.schedule_visits (app_id, starts_at);

create trigger schedule_settings_set_updated_at
  before update on public.schedule_settings
  for each row execute function public.set_updated_at();

create trigger schedule_customers_set_updated_at
  before update on public.schedule_customers
  for each row execute function public.set_updated_at();

create trigger schedule_visits_set_updated_at
  before update on public.schedule_visits
  for each row execute function public.set_updated_at();

alter table public.schedule_settings enable row level security;
alter table public.schedule_customers enable row level security;
alter table public.schedule_series enable row level security;
alter table public.schedule_visits enable row level security;

create policy "org editors can manage their apps' schedule settings"
  on public.schedule_settings for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create policy "org editors can manage their apps' schedule customers"
  on public.schedule_customers for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create policy "org editors can manage their apps' schedule series"
  on public.schedule_series for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create policy "org editors can manage their apps' schedule visits"
  on public.schedule_visits for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));
