-- "BYOB: Bring your own bot". An organization can save its own AI key (Anthropic or OpenAI) and then build its apps
-- by chatting in the builder; the AI usage is billed to the organization's own AI account, not to TapAndLaunch.
--
-- The key is encrypted by the server (AES-256-GCM) before it is stored, and only server code ever reads it. There are
-- deliberately no policies on this table, so nothing in a browser can read or change it; the dashboard learns only
-- the provider, the model and the last four characters (`key_hint`) through server routes that check membership.
create table public.org_ai_keys (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('anthropic', 'openai')),
  encrypted_key text not null,
  key_hint text not null,
  model text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger org_ai_keys_set_updated_at
  before update on public.org_ai_keys
  for each row execute function public.set_updated_at();

alter table public.org_ai_keys enable row level security;

-- The usage counter now tells "describe your app" designs and builder chat messages apart, so each has its own limit.
alter table public.ai_generations add column kind text not null default 'describe' check (kind in ('describe', 'chat'));
