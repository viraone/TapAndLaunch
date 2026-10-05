-- "Describe your app in a sentence" asks a language model to design a first version, which costs a little each time.
-- This table is only a counter so each person can be limited to a few designs a day. Written and read by server code
-- with the service-role key; there are deliberately no policies, so nobody can read or change it from the browser.
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);

create index ai_generations_user_created_idx on public.ai_generations(user_id, created_at desc);

alter table public.ai_generations enable row level security;
