-- Photos in the group chat: one optional photo per message, kept in a private bucket.
alter table public.group_chat_messages add column image_path text;

-- A message may now be a photo with no text; text-only messages still need 1 to 4,000 characters.
alter table public.group_chat_messages drop constraint group_chat_messages_body_check;
alter table public.group_chat_messages add constraint group_chat_messages_body_check
  check (char_length(btrim(body)) <= 4000 and (image_path is not null or char_length(btrim(body)) >= 1));

-- Private on purpose: only the service-role route reads or writes these files (no policies).
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;
