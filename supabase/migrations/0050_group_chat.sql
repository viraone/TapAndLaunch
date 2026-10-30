-- Group chat for a published app: a members-only message list whose readers are the people on the app's own
-- allowlist. The first use is the Intro to Stand-Up class (introtostandup, page group-chat), so a student sees the
-- class chat only after signing in with the email their teacher has.
--
-- Both tables are read and written only by the service-role route under published-apps/[appSlug]/group-chat, so
-- neither has a policy: no anon or signed-in Supabase user can read the allowlist, another member's email, or a
-- message with the anon key. The allowlist never goes into a block's config (which is public), and the viewer only
-- ever learns their own display name and role.

-- ---------------------------------------------------------------------------
-- group_chat_members: who may read and post in this app's chat. One row per person, matched to a signed-in
-- app_members row by lower-cased email. The name and role here are what the chat shows and stores with each
-- message (the member's own profile name is ignored, so nobody can label themselves Teacher).
-- ---------------------------------------------------------------------------
create table public.group_chat_members (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.apps(id) on delete cascade,
  -- Lower-case, trimmed: the chat matches a signed-in member's email against this with the same normalisation.
  email text not null check (email = lower(btrim(email)) and position('@' in email) > 1),
  -- 1 to 80 characters after trimming; the name shown beside every message.
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  -- 'teacher' gets a Teacher badge in the chat; everyone else is a student.
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  unique (app_id, email)
);

-- The unique (app_id, email) constraint already indexes the allowlist lookup; this one serves the role listing.
create index group_chat_members_app_role_idx on public.group_chat_members(app_id, role);

alter table public.group_chat_members enable row level security;

-- No policies on purpose: only the service-role route reads or writes the list.

-- ---------------------------------------------------------------------------
-- group_chat_messages: the messages themselves. `author_name` and `author_role` are snapshots taken when the
-- message is sent, so history survives a renamed or removed allowlist row; `author_member_id` is only for "mine"
-- and for excluding the sender from their own push, and is set null if that member account is deleted.
-- ---------------------------------------------------------------------------
create table public.group_chat_messages (
  id bigint generated always as identity primary key,
  app_id uuid not null references public.apps(id) on delete cascade,
  author_member_id uuid references public.app_members(id) on delete set null,
  author_name text not null,
  author_role text not null check (author_role in ('student', 'teacher')),
  -- 1 to 4,000 characters after trimming; the route enforces the same limit before inserting.
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- The poll query: messages for one app after a cursor, in id order.
create index group_chat_messages_app_id_id_idx on public.group_chat_messages(app_id, id);

alter table public.group_chat_messages enable row level security;

-- No policies on purpose: only the service-role route reads or writes messages.

-- The builder and the save route learn block types from BLOCK_TYPES (src/lib/builder/block-defaults.ts); the
-- database keeps the same list. Replace the previous rule with the current 28 types plus group_chat.
alter table public.blocks drop constraint if exists blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory', 'food_directory',
    'open_mic_signup', 'class_finder',
    'hero', 'price_list', 'hours', 'reviews', 'stats', 'gallery',
    'files', 'button', 'quote', 'faq',
    'image_text', 'newsletter', 'share', 'map', 'audio',
    'group_chat'
  ));
