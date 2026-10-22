-- StageTime: the Lineup page for a screen at the Rickshaw (stagetimepnw.tapandlaunch.com/lineup). Run once in the
-- TapAndLaunch project's SQL editor, after the code with the "lineup" block view (branch rickshaw-lineup) is on prod.
-- The page is not in the tab bar; it is opened by its address. It reads the host's Google Sheet through the
-- rickshaw-open-mic `lineup-feed` function (names, set lengths and start times only) on show day from 6 AM until
-- requests reopen at 9:40 PM, and names the next show the rest of the week.
begin;
with app as (select id, theme from apps where slug = 'stagetimepnw'),
signup as (
  select b.config from blocks b join pages p on p.id = b.page_id join app on app.id = p.app_id
  where b.type = 'open_mic_signup' and coalesce(b.config->>'view', 'signup') = 'signup'
),
pg as (
  insert into pages (app_id, name, path, position, is_home)
  select id, 'Lineup', 'lineup', 6, false from app
  returning id
)
insert into blocks (page_id, type, position, config)
select pg.id, 'open_mic_signup', 0,
       jsonb_build_object(
         'view', 'lineup',
         'show_name', coalesce(signup.config->>'show_name', app.theme->>'header_title'),
         'venue', 'Rickshaw',
         'show_time', 'Every Friday · 7–9 PM',
         'logo_url', app.theme->>'header_logo_url',
         'time_zone', signup.config->>'time_zone',
         'supabase_url', signup.config->>'supabase_url',
         'anon_key', signup.config->>'anon_key',
         'lineup_url', 'https://ldodkbdzljfpbnzrpxpu.supabase.co/functions/v1/lineup-feed')
from pg, signup, app;
commit;
