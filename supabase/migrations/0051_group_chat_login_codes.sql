-- Passwordless sign-in for the group chat: a six-digit code is emailed to an address on the app's
-- `group_chat_members` list, and entering it creates (or reuses) that person's `app_members` account and member
-- session. The code itself is never stored — only its SHA-256 hash with the server's session secret — and each code
-- works once, for ten minutes, with at most five tries.
--
-- Read and written only by the service-role routes under published-apps/[appSlug]/group-chat. RLS is on with no
-- policies, like 0050: no anon or signed-in Supabase user can read a hash or an email address.

create table public.group_chat_login_codes (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  -- Lower-case, trimmed: the routes normalise the typed address the same way before looking a row up.
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  -- SHA-256 of the six-digit code plus MEMBER_SESSION_SECRET, as 64 lower-case hex characters. The plain code only
  -- ever exists in the email that was sent and in the verify request.
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  -- Ten minutes after the code was created; the verify route ignores rows at or past this.
  expires_at timestamptz not null,
  -- Wrong guesses so far; the route burns the code at five, so a six-digit code cannot be brute-forced.
  attempts integer not null default 0 check (attempts >= 0),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Newest first for one app and email: the verify lookup, and the hour-long rate-limit count in the code route.
create index group_chat_login_codes_app_email_created_idx
  on public.group_chat_login_codes(app_id, email, created_at);

alter table public.group_chat_login_codes enable row level security;

-- No policies on purpose: only the service-role routes read or write login codes.
