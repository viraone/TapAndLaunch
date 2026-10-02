-- Google Maps features (Live food, Gas prices) cost real money per visitor,
-- so they are off for new organizations until a platform admin switches
-- them on. Every organization that exists today keeps them.

alter table public.organizations
  add column maps_enabled boolean not null default false;

-- Backfill before the guard trigger exists: today's organizations keep
-- what they already have.
update public.organizations set maps_enabled = true;

-- Platform admins: people who run TapAndLaunch itself, as opposed to
-- members of a customer's organization.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

create policy "platform admins can see themselves"
  on public.platform_admins for select
  using (user_id = auth.uid());

create or replace function public.is_platform_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- Org admins may update their own organization row (name, branding), so the
-- switch itself must be protected here, not just hidden in the UI: only a
-- platform admin or a server-side role may change it.
create or replace function public.guard_maps_enabled()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or public.is_platform_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.maps_enabled then
      raise exception 'Only a platform admin can enable Google Maps features.' using errcode = '42501';
    end if;
  elsif new.maps_enabled is distinct from old.maps_enabled then
    raise exception 'Only a platform admin can change Google Maps features.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger organizations_guard_maps_enabled
  before insert or update on public.organizations
  for each row execute function public.guard_maps_enabled();

-- The owner of the platform.
insert into public.platform_admins (user_id)
  select id from auth.users where lower(email) = 'vxayananh@gmail.com'
  on conflict do nothing;
