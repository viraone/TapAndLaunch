-- Open-mic listings (StageTime on Beezer): each row keeps one StageTime record as-is
-- in `record`; src/lib/listings normalizes it and works out which dates it happens on.
-- Access follows events (0006): org members read, org editors write. The API roles'
-- table rights come from 0009's default privileges, so row-level security is the guard.
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  slug text not null,
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, slug)
);

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

alter table public.listings enable row level security;

create policy "org members can read their apps' listings"
  on public.listings for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can write their apps' listings"
  on public.listings for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));
