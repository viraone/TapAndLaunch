-- Fix: creating an organization failed with "new row violates row-level
-- security policy" — not because the INSERT was denied (it wasn't) but
-- because the route inserted with RETURNING, and Postgres applies the
-- SELECT policy ("members can read their organization") to returned rows.
-- At that instant the creator isn't a member yet, so the just-inserted row
-- is invisible to them and Postgres reports it as an RLS violation.
--
-- The fix is the atomic function Phase 1's route comment said it would
-- want eventually: insert the org and the admin membership in one
-- transaction as SECURITY DEFINER (bypassing RLS for these two writes
-- only), then return the org — now visible, since the caller is a member.
-- Two orphan-proofing wins for one: no half-created org if the membership
-- insert fails, and no RETURNING-visibility problem.

create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.organizations (name, slug)
  values (p_name, p_slug)
  returning * into v_org;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org.id, auth.uid(), 'admin');

  return v_org;
end;
$$;

-- Callable by signed-in dashboard users; never by the anon role.
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
