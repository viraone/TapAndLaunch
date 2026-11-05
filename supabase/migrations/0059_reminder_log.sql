-- One row per automatic reminder email (Scheduling, phase 5).
--
-- The unique key is what makes sending safe: the sender claims a visit by
-- inserting its row BEFORE asking Gmail to send, so two overlapping cron runs
-- can never both email the same visit. Only the service-role sender writes
-- here; editors can read the last few rows on the Reminders page.
--
-- `error` holds a short code ('no_email', 'send_failed', 'rate_limited',
-- 'interrupted', 'bad_address') and nothing else. Never a token, a message
-- body or Gmail's response text.

create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  visit_id uuid not null references public.schedule_visits(id) on delete cascade,
  kind text not null default 'before' check (kind in ('before')),
  status text not null check (status in ('sending', 'sent', 'failed', 'skipped')),
  error text,
  to_email text,
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One reminder per visit.
  unique (visit_id, kind)
);

create index reminder_log_app_created_idx
  on public.reminder_log (app_id, created_at desc);

alter table public.reminder_log enable row level security;

-- Editors can see their app's log. There is no insert, update or delete
-- policy on purpose: only the service-role sender writes, and RLS refuses
-- every other write.
create policy "org editors can read their apps' reminder log"
  on public.reminder_log for select
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create trigger reminder_log_set_updated_at
  before update on public.reminder_log
  for each row execute function public.set_updated_at();

-- Only the service-role sender writes this table. RLS already refuses every write from an owner or the public key;
-- taking the privileges away as well means a future policy mistake cannot open it up.
revoke insert, update, delete on table public.reminder_log from anon, authenticated;
revoke all on table public.reminder_log from anon;
