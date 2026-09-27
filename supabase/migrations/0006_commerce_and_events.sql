-- Phase 5: a simple product catalog + order-request flow, an event
-- calendar + booking flow, and two "thin wrapper" embed block types
-- (Zoom meeting links, Canva embeds) that need no new tables at all.
--
-- No payment processor is wired up yet (that's Phase 7's billing work) —
-- an "order" here is a purchase *request* a merchant follows up on
-- manually, not a paid transaction. Terminology below deliberately avoids
-- "paid"/"payment" for that reason.

-- ---------------------------------------------------------------------------
-- products: no variants/inventory tracking — one price per product. A
-- curated per-block product selection doesn't exist either; the
-- `product_list` block always shows every active product for its app (see
-- the block-level comment in BlockRenderer.tsx).
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'usd',
  image_url text,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_app_id_idx on public.products(app_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

create policy "org members can read their apps' products"
  on public.products for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can write their apps' products"
  on public.products for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

-- ---------------------------------------------------------------------------
-- orders / order_items: one order per checkout, snapshotting each item's
-- name/price at order time so a later product edit (or deletion) never
-- rewrites history. Written by the published-app runtime's order route via
-- the service-role client (a customer isn't a Supabase Auth user, and may
-- not even be a signed-in app_member) — same pattern as app_members,
-- form_submissions, etc.
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  member_id uuid references public.app_members(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'usd',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_app_id_created_at_idx on public.orders(app_id, created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

create policy "org members can read their apps' orders"
  on public.orders for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can update their apps' orders"
  on public.orders for update
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items(order_id);

alter table public.order_items enable row level security;

create policy "org members can read their apps' order items"
  on public.order_items for select
  using (
    public.is_org_member((
      select a.organization_id from public.apps a
      join public.orders o on o.app_id = a.id
      where o.id = order_id
    ))
  );

-- ---------------------------------------------------------------------------
-- events / bookings: same "show everything upcoming" simplification as
-- products — the `event_calendar` block lists every future event for its
-- app, no per-block curation.
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_app_id_starts_at_idx on public.events(app_id, starts_at);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;

create policy "org members can read their apps' events"
  on public.events for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can write their apps' events"
  on public.events for all
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  member_id uuid references public.app_members(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  created_at timestamptz not null default now()
);

create index bookings_event_id_idx on public.bookings(event_id);
create index bookings_app_id_created_at_idx on public.bookings(app_id, created_at desc);

alter table public.bookings enable row level security;

create policy "org members can read their apps' bookings"
  on public.bookings for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

-- No insert/update/delete policy for orders/order_items/bookings beyond
-- the org-editor update on orders above — creation is always the
-- service-role order/booking routes, deletion isn't exposed anywhere yet.

-- ---------------------------------------------------------------------------
-- New block types for this phase, plus their analytics events.
-- ---------------------------------------------------------------------------
alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in ('text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar', 'zoom_meeting', 'canva_embed'));

alter table public.analytics_events drop constraint analytics_events_event_type_check;
alter table public.analytics_events add constraint analytics_events_event_type_check
  check (event_type in (
    'view', 'install', 'click', 'push_sent', 'push_opened', 'email_sent', 'sms_sent',
    'order_placed', 'booking_created'
  ));
