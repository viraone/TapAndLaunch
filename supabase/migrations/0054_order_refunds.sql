-- Order management phase 3: refunds. Money goes back through the seller's own
-- connected Stripe account, so this table is the ledger of every attempt and
-- the idempotency key that made it safe to retry. Only server code holding the
-- service-role key writes it — there is deliberately no insert/update/delete
-- policy, so a merchant can never invent a refund from the browser.

alter table public.orders
  add column refunded_cents integer not null default 0 check (refunded_cents >= 0);

-- Orders already marked refunded before this column existed had all their money back.
update public.orders set refunded_cents = total_cents where status = 'refunded';

-- ---------------------------------------------------------------------------
-- order_refunds: one row per attempt, kept even when it fails so its
-- idempotency key can never quietly pay out twice. `stripe_refund_id` stays
-- null until Stripe accepts the refund; `created_by_email` is a snapshot so a
-- later account change does not rewrite who sent the money back.
-- ---------------------------------------------------------------------------
create table public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  idempotency_key text not null,
  stripe_refund_id text unique,
  amount_cents integer not null check (amount_cents > 0),
  reason text check (reason is null or char_length(reason) <= 200),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  unique (order_id, idempotency_key)
);

create index order_refunds_order_id_created_at_idx on public.order_refunds(order_id, created_at desc);

alter table public.order_refunds enable row level security;

create policy "org members can read their apps' order refunds"
  on public.order_refunds for select
  using (
    public.is_org_member((
      select a.organization_id from public.apps a
      join public.orders o on o.app_id = a.id
      where o.id = order_id
    ))
  );
