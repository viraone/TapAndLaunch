-- Phase 2: contact-form submissions. Same access pattern as app_members /
-- analytics_events — written by the published-app runtime with the
-- service-role client (submitters are anonymous visitors, not RLS-scoped
-- authenticated users), read by org members from the dashboard.

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  page_id uuid references public.pages(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index form_submissions_app_id_created_at_idx on public.form_submissions(app_id, created_at desc);

alter table public.form_submissions enable row level security;

create policy "org members can read their apps' form submissions"
  on public.form_submissions for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

-- No insert/update/delete policy for anon/authenticated roles by design —
-- see the migration 0001 comment on `app_members` for why.
