-- Order management phase 2: free-form tags on an order and an internal note
-- thread per order. Notes are for the merchant only — no customer-facing or
-- published-app route reads them.

alter table public.orders
  add column tags text[] not null default '{}';

create index orders_tags_idx on public.orders using gin (tags);

-- ---------------------------------------------------------------------------
-- order_notes: append/delete only; there is deliberately no update policy,
-- so an edit is a delete followed by a new note. `author_email` is a snapshot
-- so a later account change does not rewrite who wrote an old note.
-- ---------------------------------------------------------------------------
create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_email text,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index order_notes_order_id_created_at_idx on public.order_notes(order_id, created_at desc);

alter table public.order_notes enable row level security;

create policy "org members can read their apps' order notes"
  on public.order_notes for select
  using (
    public.is_org_member((
      select a.organization_id from public.apps a
      join public.orders o on o.app_id = a.id
      where o.id = order_id
    ))
  );

create policy "org editors can add notes to their apps' orders"
  on public.order_notes for insert
  with check (
    author_id = auth.uid()
    and public.is_org_editor((
      select a.organization_id from public.apps a
      join public.orders o on o.app_id = a.id
      where o.id = order_id
    ))
  );

create policy "org editors can delete their apps' order notes"
  on public.order_notes for delete
  using (
    public.is_org_editor((
      select a.organization_id from public.apps a
      join public.orders o on o.app_id = a.id
      where o.id = order_id
    ))
  );
