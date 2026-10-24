-- StageTime: the phones that want a "You're up next!" push when the hosts move the lineup spotlight to them.
--
-- Kept apart from push_subscriptions (TapAndLaunch app members) because a comic is a user of the show's own
-- Supabase project, not an app_member. A row is written by the comic's own phone (its token is checked against the
-- show's project first) and read by the hosts' Remote tab through the server, which matches the highlighted lineup
-- row by name: `name_key` is the stage name lower-cased, trimmed and with spaces collapsed, refreshed with the exact
-- lineup-row name whenever the comic opens the app on show day.
create table public.openmic_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  -- The comic's user id and email in the show's project (not this database's auth.users).
  user_id uuid not null,
  email text not null,
  name text not null,
  name_key text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index openmic_push_subscriptions_app_name_idx on public.openmic_push_subscriptions(app_id, name_key);
create index openmic_push_subscriptions_app_user_idx on public.openmic_push_subscriptions(app_id, user_id);

alter table public.openmic_push_subscriptions enable row level security;

-- No policies on purpose: only the service-role routes under published-apps/[appSlug]/openmic/ read or write it.
