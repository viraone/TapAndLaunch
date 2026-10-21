-- Domains bought through TapAndLaunch: registered in the platform's own NameSilo account for a customer's app, paid
-- for with Stripe Checkout on our own account (one payment, the registrar's price). One row per purchase, written from
-- the moment checkout opens, so a payment can always be matched back to the app it was for.
--
-- status: pending (checkout open) -> paid (money in, registering) -> registered (in the account, attached to the app);
-- failed (paid, but the registrar refused: refund by hand, `error` says why); cancelled (checkout expired or abandoned).
-- Like org_billing, only server code writes rows (service role); members can see their organization's orders.
create table public.domain_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  domain text not null,
  years integer not null default 1,
  price_cents integer not null,
  renew_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'paid', 'registered', 'failed', 'cancelled')),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  -- The registration's expiry at the registrar; renewals are handled by hand for now (see docs/custom-domains.md).
  expires_at date,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index domain_orders_app_id_idx on public.domain_orders (app_id);
create index domain_orders_organization_id_idx on public.domain_orders (organization_id);

create trigger domain_orders_set_updated_at
  before update on public.domain_orders
  for each row execute function public.set_updated_at();

alter table public.domain_orders enable row level security;

create policy "org members can read their organization's domain orders"
  on public.domain_orders for select
  using (public.is_org_member(organization_id));
