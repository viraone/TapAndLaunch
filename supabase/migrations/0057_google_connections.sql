-- One connected Gmail account per app, for reminders (Scheduling, phase 3).
--
-- The refresh token lets the server send email as the owner, so it is encrypted by the app before it ever reaches
-- this table (`src/lib/integrations/google/crypto.ts`) and only the service-role routes under
-- api/integrations/google read it. No policy on purpose: no anon or signed-in Supabase user can read the token or
-- the connected address, and every caller has already been checked with isAppEditor.
create table public.google_connections (
  app_id uuid primary key references public.apps(id) on delete cascade,
  google_email text not null,
  refresh_token_enc text not null,
  scopes text[] not null default '{}',
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  -- Last time Google said the grant is gone. "reconnect" is the only value written today.
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.google_connections enable row level security;

-- No policies on purpose: only the service-role client touches this table.
revoke all on table public.google_connections from anon, authenticated;

create trigger google_connections_set_updated_at
  before update on public.google_connections
  for each row execute function public.set_updated_at();
