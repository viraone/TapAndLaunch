-- Phase 4: notifications (Web Push, email, SMS) — targeted at "all members"
-- or "members of one tier", reusing the tier concept Phase 3 introduced.

-- ---------------------------------------------------------------------------
-- push_subscriptions: one row per browser subscription (a member may have
-- several — one per device/browser). `member_id` is nullable because a
-- visitor can grant notification permission without being signed in as a
-- member; a null-member subscription is only reachable by an "all
-- visitors" send, never a tier-targeted one.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  member_id uuid references public.app_members(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_app_id_idx on public.push_subscriptions(app_id);

alter table public.push_subscriptions enable row level security;

create policy "org members can read their apps' push subscriptions"
  on public.push_subscriptions for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

-- No insert/update/delete policy for anon/authenticated roles — the
-- subscribe/unsubscribe routes always use the service-role client, the same
-- pattern as app_members and analytics_events, since a subscribing visitor
-- may not be a signed-in member at all.

-- ---------------------------------------------------------------------------
-- SMS needs a phone number, which members don't provide today. Nullable and
-- optional at signup — SMS sends simply skip members who never gave one.
-- ---------------------------------------------------------------------------
alter table public.app_members add column phone text;

-- ---------------------------------------------------------------------------
-- Extend analytics_events.event_type to cover email/SMS sends, so every
-- notification channel's send history lives in one queryable table rather
-- than push getting a event log and email/SMS getting none. Assumes
-- Postgres's default constraint-naming convention for an inline column
-- check declared in the original `create table`
-- (`{table}_{column}_check`) — true for a fresh migration history with no
-- manual renames, which is what this repo has.
-- ---------------------------------------------------------------------------
alter table public.analytics_events drop constraint analytics_events_event_type_check;
alter table public.analytics_events add constraint analytics_events_event_type_check
  check (event_type in ('view', 'install', 'click', 'push_sent', 'push_opened', 'email_sent', 'sms_sent'));
