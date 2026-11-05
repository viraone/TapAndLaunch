-- The owner's reminder email for an app with Scheduling on (Scheduling phase 4).
-- Automatic sending arrives in phase 5; for now this row only feeds the editor
-- and the "Send me a test" button. `enabled` is saved for phase 5 and has no UI
-- yet.

create table public.reminder_settings (
  app_id uuid primary key references public.apps(id) on delete cascade,
  enabled boolean not null default false,
  hours_before integer not null default 24 check (hours_before in (1, 2, 4, 12, 24, 48, 72)),
  subject text not null check (char_length(subject) between 1 and 150),
  body text not null check (char_length(body) between 1 and 3000),
  prep_note text check (prep_note is null or char_length(prep_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reminder_settings enable row level security;

create policy "org editors can manage their apps' reminder settings"
  on public.reminder_settings for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create trigger reminder_settings_set_updated_at
  before update on public.reminder_settings
  for each row execute function public.set_updated_at();
