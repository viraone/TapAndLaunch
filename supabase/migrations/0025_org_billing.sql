-- TapAndLaunch's own plans: what each organization pays us (separate from stripe_accounts, which is where
-- an organization's *customers* pay *them*).
--
-- One row per organization. A new organization starts a free trial (30 days, no card). Organizations that
-- existed before this migration are `complimentary` (free, no limit): they are the owner's own apps and
-- early users, and billing must never lock them out. Read by org members so the dashboard can show the
-- plan; written only by server code with the service-role key (checkout return and the Stripe billing
-- webhook), with deliberately no insert/update/delete policies, so an organization can never grant itself
-- a plan. (That is why this is its own table and not columns on `organizations`, which org admins can update.)
--
-- The 30 here must match TRIAL_DAYS in src/lib/billing/plans.ts.
create table public.org_billing (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'complimentary')),
  trial_ends_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_interval text check (plan_interval in ('month', 'year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger org_billing_set_updated_at
  before update on public.org_billing
  for each row execute function public.set_updated_at();

alter table public.org_billing enable row level security;

create policy "org members can read their organization's billing"
  on public.org_billing for select
  using (public.is_org_member(organization_id));

-- Everyone who already exists is complimentary.
insert into public.org_billing (organization_id, status)
select id, 'complimentary' from public.organizations;

-- Every new organization starts its trial.
create or replace function public.start_org_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.org_billing (organization_id, status, trial_ends_at)
  values (new.id, 'trialing', now() + interval '30 days');
  return new;
end;
$$;

create trigger organizations_start_trial
  after insert on public.organizations
  for each row execute function public.start_org_trial();
