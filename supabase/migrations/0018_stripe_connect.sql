-- Phase 7 (stores): real card payments through Stripe Connect.
--
-- Each organization connects its own Stripe account (a "Standard" connected
-- account). Shoppers pay on Stripe's hosted checkout page and the money goes
-- straight to that account; we never see card details. A shopper's order
-- starts as before (pending) and a Stripe webhook flips it to `paid`.
--
-- Organizations that haven't connected Stripe keep the existing flow: the
-- order is a purchase *request* the merchant follows up on by hand
-- (`payment_method = 'request'`).

-- ---------------------------------------------------------------------------
-- stripe_accounts: which Stripe account an organization is paid into. Read by
-- org members (so the dashboard can show status); written only by server code
-- with the service-role key — there are deliberately no insert/update/delete
-- policies, so an organization can never point itself at someone else's
-- Stripe account.
-- ---------------------------------------------------------------------------
create table public.stripe_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger stripe_accounts_set_updated_at
  before update on public.stripe_accounts
  for each row execute function public.set_updated_at();

alter table public.stripe_accounts enable row level security;

create policy "org members can read their organization's stripe account"
  on public.stripe_accounts for select
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- orders: how the order is being paid, and the Stripe ids needed to match the
-- webhook back to it. `paid` and `refunded` are only ever set by the webhook.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column payment_method text not null default 'request' check (payment_method in ('request', 'stripe')),
  add column stripe_checkout_session_id text unique,
  add column stripe_payment_intent_id text,
  add column paid_at timestamptz;

create index orders_stripe_payment_intent_idx on public.orders(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.orders drop constraint orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded'));
