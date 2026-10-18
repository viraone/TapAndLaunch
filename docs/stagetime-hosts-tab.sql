-- StageTime: the Hosts page (the hosts' group chat) and its tab, which only the hosts see (show_if, set by the app
-- after asking the show's database). Run once in the TapAndLaunch project.
begin;
with app as (select id from apps where slug = 'stagetimepnw'),
signup as (
  select b.config from blocks b join pages p on p.id = b.page_id join app on app.id = p.app_id
  where b.type = 'open_mic_signup' and coalesce(b.config->>'view', 'signup') = 'signup'
),
pg as (
  insert into pages (app_id, name, path, position, is_home)
  select id, 'Hosts', 'hosts', 4, false from app
  returning id
)
insert into blocks (page_id, type, position, config)
select pg.id, 'open_mic_signup', 0,
       jsonb_build_object('view', 'hosts', 'supabase_url', signup.config->>'supabase_url', 'anon_key', signup.config->>'anon_key',
                          'time_zone', coalesce(signup.config->>'time_zone', 'America/Los_Angeles'))
from pg, signup;

update apps
set theme = jsonb_set(theme, '{bottom_nav}', (theme->'bottom_nav') || '[{"icon": "chat", "label": "Hosts", "page_path": "hosts", "show_if": "openmic-hosts"}]'::jsonb)
where slug = 'stagetimepnw';
commit;
