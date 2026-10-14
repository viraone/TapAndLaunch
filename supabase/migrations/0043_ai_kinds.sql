-- Three more things the AI does for an app, each counted against its own daily limit:
--   edit   one section's words, rewritten to an instruction (Cmd+K in the builder)
--   agent  a change across the site (new pages, sections, words), reviewed section by section
--   inbox  a pasted flyer, post or email turned into shows, photos or a notice (Quick updates, email)
alter table public.ai_generations drop constraint ai_generations_kind_check;
alter table public.ai_generations add constraint ai_generations_kind_check check (kind in ('describe', 'chat', 'code', 'edit', 'agent', 'inbox'));
