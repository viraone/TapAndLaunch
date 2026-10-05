-- Taking an app down, and letting anyone report one.
--
-- An app that breaks the rules (phishing, malware, scams, illegal content) can be taken down by a platform admin:
-- it stops being served everywhere it was published, and its owner can't publish it again until it is restored.
-- Editors can update their own app rows, so the takedown columns are guarded here, not just hidden in the UI.

alter table public.apps
  add column suspended_at timestamptz,
  add column suspended_reason text;

create or replace function public.guard_app_suspension()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or public.is_platform_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.suspended_at is not null or new.suspended_reason is not null then
      raise exception 'Only TapAndLaunch can take an app down.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.suspended_at is distinct from old.suspended_at or new.suspended_reason is distinct from old.suspended_reason then
    raise exception 'Only TapAndLaunch can take an app down or restore it.' using errcode = '42501';
  end if;
  -- A taken-down app can't be published again by its owner.
  if old.suspended_at is not null and new.status = 'published' and old.status is distinct from 'published' then
    raise exception 'This app was taken down and can''t be published.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger apps_guard_suspension
  before insert or update on public.apps
  for each row execute function public.guard_app_suspension();

-- Reports from anyone who visits a published app. Written and read only by the server (no policies: the service role
-- bypasses row level security, everyone else sees nothing).
create table public.app_reports (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  reason text not null check (reason in ('phishing', 'malware', 'scam', 'illegal', 'other')),
  details text check (char_length(details) <= 2000),
  contact text check (char_length(contact) <= 200),
  -- A one-way hash of the reporter's network address, only to limit how often one person can report.
  reporter_hash text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index app_reports_app_created_idx on public.app_reports(app_id, created_at desc);
create index app_reports_reporter_created_idx on public.app_reports(reporter_hash, created_at desc);

alter table public.app_reports enable row level security;
