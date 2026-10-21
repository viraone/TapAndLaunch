-- Store phase 1: a cart of several products per order, with shipping, sales tax, promo codes and
-- subscriptions handled by Stripe Checkout rather than a commerce engine of our own.
--
-- A product can be one-time (billing_interval null) or recurring (month / year). A cart holding any
-- recurring product checks out in Stripe's subscription mode; the first payment lands as a paid
-- order like any other, and Stripe runs the renewals from then on.
--
-- Shipping rates, the ship-to list, tax and promo codes are per app (`store_settings`), chosen by
-- the owner on the products page. Stripe collects the address, works out the tax (Stripe Tax on the
-- connected account) and applies the code; what it charged comes back on the order when it's paid.

alter table public.products
  add column billing_interval text check (billing_interval in ('month', 'year'));

alter table public.order_items
  add column billing_interval text check (billing_interval in ('month', 'year'));

-- ---------------------------------------------------------------------------
-- store_settings: one row per app, created the first time the owner changes
-- anything. Read by org members, written by org editors — like products.
-- `shipping_rates` is a list of {name, amount_cents, min_days?, max_days?}
-- (at most 5, Stripe's limit per checkout).
-- ---------------------------------------------------------------------------
create table public.store_settings (
  app_id uuid primary key references public.apps(id) on delete cascade,
  shipping_enabled boolean not null default false,
  shipping_rates jsonb not null default '[]'::jsonb,
  ship_to_countries text[] not null default '{US}',
  tax_enabled boolean not null default false,
  promo_codes_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

alter table public.store_settings enable row level security;

create policy "org members can read their apps' store settings"
  on public.store_settings for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can write their apps' store settings"
  on public.store_settings for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

-- ---------------------------------------------------------------------------
-- orders: what Stripe added on top of the items. `total_cents` starts as the
-- items' subtotal and becomes Stripe's grand total (items + shipping + tax
-- - discount) once paid. The address is whatever the shopper typed on
-- Stripe's page, kept as Stripe's own address shape.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column shipping_cents integer not null default 0 check (shipping_cents >= 0),
  add column tax_cents integer not null default 0 check (tax_cents >= 0),
  add column discount_cents integer not null default 0 check (discount_cents >= 0),
  add column shipping_name text,
  add column shipping_address jsonb,
  add column stripe_subscription_id text;
