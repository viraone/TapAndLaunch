-- The platform admin's own to-do list, shown first on the TapAndLaunch daily board (/dashboard/admin/tapandlaunch).
-- Items the code seeds have a `key` so they are added once and keep their tick; items typed in on the page have none.
-- Anything not ticked simply stays on the list the next day; a ticked item shows under "Done today" and then drops off.

create table public.admin_todos (
  id uuid primary key default gen_random_uuid(),
  key text unique,
  title text not null check (char_length(title) between 1 and 200),
  detail text check (char_length(detail) <= 600),
  section text not null default 'Mine' check (char_length(section) between 1 and 80),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by uuid references auth.users(id) on delete set null
);

alter table public.admin_todos enable row level security;

-- Platform admins only, for everything. (The board itself reads and writes with the service role after the same check.)
create policy "platform admins manage the to-do list"
  on public.admin_todos for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
