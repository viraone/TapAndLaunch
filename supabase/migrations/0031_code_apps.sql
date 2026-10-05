-- "BYOB: Bring your own bot", code mode: the customer's own AI writes a real React app, shown in a locked-down sandbox.
--
-- `apps.kind` is 'blocks' (the builder with blocks, as before) or 'code' (an AI-written React app). Every version the AI
-- writes is kept in `app_code_versions` (the whole set of files as JSON), so changes can be undone and compared.
-- `apps.code_published_version` is the version visitors see; drafts never reach them until the owner publishes.
alter table public.apps
  add column kind text not null default 'blocks' check (kind in ('blocks', 'code')),
  add column code_published_version integer;

create table public.app_code_versions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  version integer not null,
  files jsonb not null check (jsonb_typeof(files) = 'object'),
  prompt text,
  summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (app_id, version)
);

create index app_code_versions_app_idx on public.app_code_versions(app_id, version desc);

alter table public.app_code_versions enable row level security;

create policy "org members can read their apps' code versions"
  on public.app_code_versions for select
  using (public.is_org_member((select organization_id from public.apps where id = app_id)));

create policy "org editors can write their apps' code versions"
  on public.app_code_versions for insert
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

-- Code generation is counted separately from chat edits and "describe your app".
alter table public.ai_generations drop constraint ai_generations_kind_check;
alter table public.ai_generations add constraint ai_generations_kind_check check (kind in ('describe', 'chat', 'code'));
