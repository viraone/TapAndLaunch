-- StageTime: the "Message the Hosts" page (a comedian's private line to the hosts) and its tab, shown to signed-in
-- comedians who are not hosts (show_if, set by the app after asking the show's database). Run once in the
-- TapAndLaunch project, after the app code that knows view "messages" is live.
begin;
with app as (select id from apps where slug = 'stagetimepnw'),
signup as (
  select b.config from blocks b join pages p on p.id = b.page_id join app on app.id = p.app_id
  where b.type = 'open_mic_signup' and coalesce(b.config->>'view', 'signup') = 'signup'
),
pg as (
  insert into pages (app_id, name, path, position, is_home)
  select id, 'Message the Hosts', 'message-hosts', 5, false from app
  returning id
)
insert into blocks (page_id, type, position, config)
select pg.id, 'open_mic_signup', 0,
       jsonb_build_object('view', 'messages', 'supabase_url', signup.config->>'supabase_url', 'anon_key', signup.config->>'anon_key',
                          'time_zone', coalesce(signup.config->>'time_zone', 'America/Los_Angeles'))
from pg, signup;

update apps
set theme = jsonb_set(theme, '{bottom_nav}', (theme->'bottom_nav') || '[{"icon": "chat", "label": "Message the Hosts", "page_path": "message-hosts", "show_if": "openmic-comic"}]'::jsonb)
where slug = 'stagetimepnw';
commit;
