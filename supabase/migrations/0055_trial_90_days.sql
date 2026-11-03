-- New organizations start with a 90-day free trial (no card), up from 30.
--
-- Only the trigger function changes: organizations that already exist keep the trial_ends_at already on their
-- org_billing row, so no existing customer's trial dates move. The trigger itself stays attached to this function.
--
-- The 90 here must match TRIAL_DAYS in src/lib/billing/plans.ts.
create or replace function public.start_org_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.org_billing (organization_id, status, trial_ends_at)
  values (new.id, 'trialing', now() + interval '90 days');
  return new;
end;
$$;
