-- An AI-written app's own database: the owner connects their own Supabase project (its URL and public key), and the
-- app's code talks to it directly from the visitor's browser. Only the public key is stored: it is meant to be shared,
-- and the owner's own row-level security rules decide what it can do. TapAndLaunch never holds a key that can change
-- the owner's database; the owner runs the table setup the AI writes in their own SQL editor.

create table public.app_backends (
  app_id uuid primary key references public.apps(id) on delete cascade,
  provider text not null default 'supabase' check (provider = 'supabase'),
  url text not null check (url ~ '^https?://' and char_length(url) <= 200),
  anon_key text not null check (char_length(anon_key) <= 1000),
  -- Database setup files the owner has run, by path: the content's hash when they marked it run.
  applied_sql jsonb not null default '{}'::jsonb,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_backends enable row level security;

create policy "org members can read their apps' backends"
  on public.app_backends for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can connect their apps' backends"
  on public.app_backends for insert
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create policy "org editors can change their apps' backends"
  on public.app_backends for update
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create policy "org editors can disconnect their apps' backends"
  on public.app_backends for delete
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)));
