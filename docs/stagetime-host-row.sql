-- StageTime host row: row 1 of the lineup is always the hosts (HOSTS tag), ON DECK shows on row 2 as soon as the
-- lineup is up, and the hosts' START begins on row 1. Run AFTER the code with config.host_row (0f51922) is live.
-- Every StageTime page (sign-up, lineup board, remote, ...) holds its own open_mic_signup block, and each one
-- reads its own config, so the flag goes on all of them. Run in the Supabase SQL editor (prod, Viradeth only).

-- 1. See what you are about to change (expect one row per StageTime page with a block; host_row empty).
select p.path, b.id, b.config->>'view' as view, b.config->>'host_row' as host_row
from blocks b
join pages p on p.id = b.page_id
join apps a on a.id = p.app_id
where a.slug = 'stagetimepnw' and b.type = 'open_mic_signup'
order by p.path;

-- 2. Turn it ON.
update blocks b
set config = b.config || '{"host_row": true}'::jsonb
from pages p
join apps a on a.id = p.app_id
where p.id = b.page_id and a.slug = 'stagetimepnw' and b.type = 'open_mic_signup';

-- 3. Turn it OFF again (back to the old behaviour: no HOSTS tag, START skips the host).
-- update blocks b
-- set config = b.config - 'host_row'
-- from pages p
-- join apps a on a.id = p.app_id
-- where p.id = b.page_id and a.slug = 'stagetimepnw' and b.type = 'open_mic_signup';
