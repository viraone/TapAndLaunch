-- Phase 1 schema: multi-tenant orgs, PWA builder state, published-app members, analytics.
-- Tenant isolation model: row-level (organization_id on every tenant-owned row) + RLS,
-- enforced via the helper functions below rather than duplicating EXISTS subqueries
-- in every policy.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Utility: keep updated_at current on every row update.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations: the tenant / agency. Reseller white-label fields are on here
-- now (columns are cheap) even though the branding UI ships in a later phase.
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  plan text not null default 'free',
  branding jsonb not null default '{}'::jsonb, -- logo_url, primary_color, footer_text, custom_domain
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- memberships: links a Supabase Auth user to an organization with a role.
-- role is intentionally a checked text, not an enum, so adding a role later
-- (e.g. "reseller") is a migration without a type-alter dance.
-- ---------------------------------------------------------------------------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'creator', 'client')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS policies below. SECURITY DEFINER + a fixed
-- search_path so they can read `memberships` without recursing back through
-- the RLS policy defined on `memberships` itself.
-- ---------------------------------------------------------------------------
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- creator or admin: the two roles allowed to write builder content.
create or replace function public.is_org_editor(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('admin', 'creator')
  );
$$;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

create policy "members can read their organization"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "admins can update their organization"
  on public.organizations for update
  using (public.is_org_admin(id));

create policy "authenticated users can create an organization"
  on public.organizations for insert
  with check (auth.uid() is not null);

create policy "members can read memberships in their org"
  on public.memberships for select
  using (public.is_org_member(organization_id));

create policy "admins can manage memberships in their org"
  on public.memberships for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- A user can always insert their own first membership (bootstrapping a new
-- org as its admin); after that, only admins can add further members via the
-- policy above.
create policy "user can create their own admin membership"
  on public.memberships for insert
  with check (user_id = auth.uid() and role = 'admin');

-- ---------------------------------------------------------------------------
-- apps: one row per PWA a tenant builds. `slug` is the subdomain segment
-- (`{slug}.yourdomain.com`) so it is globally unique and constrained to be
-- DNS-safe. Custom-domain mapping is deferred; `custom_domain` is nullable
-- and unused by the renderer until that phase lands.
-- ---------------------------------------------------------------------------
create table public.apps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  custom_domain text unique,
  theme jsonb not null default '{}'::jsonb, -- colors, typography, header/bottom-nav config
  manifest jsonb not null default '{}'::jsonb, -- name, short_name, icons, theme_color, background_color, display
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index apps_organization_id_idx on public.apps(organization_id);

create trigger apps_set_updated_at
  before update on public.apps
  for each row execute function public.set_updated_at();

alter table public.apps enable row level security;

create policy "org members can read their apps"
  on public.apps for select
  using (public.is_org_member(organization_id));

create policy "org editors can write their apps"
  on public.apps for insert
  with check (public.is_org_editor(organization_id));

create policy "org editors can update their apps"
  on public.apps for update
  using (public.is_org_editor(organization_id))
  with check (public.is_org_editor(organization_id));

create policy "org admins can delete their apps"
  on public.apps for delete
  using (public.is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- pages: one per screen inside an app. `path` is the in-app route segment.
-- ---------------------------------------------------------------------------
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  name text not null,
  path text not null check (path ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  is_home boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, path)
);

create index pages_app_id_idx on public.pages(app_id);

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

alter table public.pages enable row level security;

create policy "org members can read pages of their apps"
  on public.pages for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can write pages of their apps"
  on public.pages for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

-- ---------------------------------------------------------------------------
-- blocks: the drag-and-drop UI elements on a page. `config` is a free-form
-- JSON blob whose shape is validated in the app layer (zod) per block `type`,
-- not in Postgres — the builder will add block types faster than migrations
-- should have to track them.
-- ---------------------------------------------------------------------------
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  type text not null check (type in ('text', 'image', 'video', 'contact_form')),
  position integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blocks_page_id_idx on public.blocks(page_id);

create trigger blocks_set_updated_at
  before update on public.blocks
  for each row execute function public.set_updated_at();

alter table public.blocks enable row level security;

create policy "org members can read blocks of their apps"
  on public.blocks for select
  using (
    public.is_org_member((
      select a.organization_id from public.apps a
      join public.pages p on p.app_id = a.id
      where p.id = page_id
    ))
  );

create policy "org editors can write blocks of their apps"
  on public.blocks for all
  using (
    public.is_org_editor((
      select a.organization_id from public.apps a
      join public.pages p on p.app_id = a.id
      where p.id = page_id
    ))
  )
  with check (
    public.is_org_editor((
      select a.organization_id from public.apps a
      join public.pages p on p.app_id = a.id
      where p.id = page_id
    ))
  );

-- ---------------------------------------------------------------------------
-- app_members: end-users who sign up *inside* a published PWA. These are not
-- Supabase Auth users (a single Supabase project's auth.users is not a good
-- fit for arbitrary end-users across many tenant-published apps) — the PWA
-- runtime issues and verifies its own session token against this table via
-- the service role, so there is no anon-key write path and no RLS policy
-- granting public access. Org members can still see their own apps' members
-- from the dashboard.
-- ---------------------------------------------------------------------------
create table public.app_members (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  email text not null,
  password_hash text not null,
  display_name text,
  tier text not null default 'default',
  created_at timestamptz not null default now(),
  unique (app_id, email)
);

create index app_members_app_id_idx on public.app_members(app_id);

alter table public.app_members enable row level security;

create policy "org members can read their apps' members"
  on public.app_members for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

-- No insert/update/delete policy for anon/authenticated roles: app_members
-- rows are written exclusively by server code using the service role key
-- (the published-app signup route), which bypasses RLS by design.

-- ---------------------------------------------------------------------------
-- analytics_events: views, installs, clicks. Same access model as
-- app_members — written server-side with the service role from the PWA
-- runtime, read from the dashboard by org members.
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  page_id uuid references public.pages(id) on delete set null,
  member_id uuid references public.app_members(id) on delete set null,
  event_type text not null check (event_type in ('view', 'install', 'click', 'push_sent', 'push_opened')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_app_id_created_at_idx on public.analytics_events(app_id, created_at desc);

alter table public.analytics_events enable row level security;

create policy "org members can read their apps' analytics"
  on public.analytics_events for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));
