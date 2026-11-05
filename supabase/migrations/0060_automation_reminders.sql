-- The owner's own reminder automations (StageTime's private Automation tab).
--
-- Every table here is reached only by the service-role sender and the private automation routes. No anon or
-- signed-in Supabase user may read or write them, so there are deliberately no policies and no grants.
-- `automation_send_log.error` holds a short code only ('rate_limited', 'send_failed', 'bad_address',
-- 'interrupted'), never a token, a message body or Gmail's answer.

create table public.automation_reminders (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  enabled boolean not null default false,
  -- Set when the reminder is switched on; occurrences before it are never sent.
  activated_at timestamptz,
  schedule_kind text not null check (schedule_kind in ('weekly', 'once')),
  -- 0 = Sunday. Required for a weekly reminder, null for a one-off.
  weekday smallint check (weekday between 0 and 6),
  -- The local date for a one-off reminder, null for a weekly one.
  once_date date,
  send_time time not null,
  time_zone text not null default 'America/Los_Angeles',
  subject text not null check (char_length(subject) between 1 and 150),
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (schedule_kind = 'weekly' and weekday is not null and once_date is null) or
    (schedule_kind = 'once' and once_date is not null and weekday is null)
  )
);

create index automation_reminders_app_idx
  on public.automation_reminders (app_id);

create table public.automation_recipients (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.automation_reminders(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  name text check (name is null or char_length(name) <= 120),
  email text not null check (
    email = lower(btrim(email)) and
    position('@' in email) > 1 and
    char_length(email) <= 254
  ),
  created_at timestamptz not null default now(),
  unique (reminder_id, email)
);

create table public.automation_send_log (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  reminder_id uuid not null references public.automation_reminders(id) on delete cascade,
  -- The scheduled instant this send belongs to; the unique key stops a second run from emailing it again.
  occurrence_at timestamptz not null,
  email text not null,
  status text not null check (status in ('sending', 'sent', 'failed')),
  -- 'rate_limited' | 'send_failed' | 'bad_address' | 'interrupted'
  error text,
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reminder_id, occurrence_at, email)
);

create index automation_send_log_app_created_idx
  on public.automation_send_log (app_id, created_at desc);

-- One-time nonces for a Google sign-in started from inside a published app.
create table public.google_oauth_states (
  nonce text primary key,
  app_id uuid not null references public.apps(id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.automation_reminders enable row level security;
alter table public.automation_recipients enable row level security;
alter table public.automation_send_log enable row level security;
alter table public.google_oauth_states enable row level security;

-- No policies on purpose: only the service-role client touches these tables.
revoke all on table public.automation_reminders from anon, authenticated;
revoke all on table public.automation_recipients from anon, authenticated;
revoke all on table public.automation_send_log from anon, authenticated;
revoke all on table public.google_oauth_states from anon, authenticated;

create trigger automation_reminders_set_updated_at
  before update on public.automation_reminders
  for each row execute function public.set_updated_at();

create trigger automation_send_log_set_updated_at
  before update on public.automation_send_log
  for each row execute function public.set_updated_at();
