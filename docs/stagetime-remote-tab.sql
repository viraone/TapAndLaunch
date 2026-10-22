-- StageTime: the Remote tab (hosts only) that drives the lineup screen, and the comics' show-day screen.
-- Run once in the TapAndLaunch project's SQL editor, after the code with the "remote" block view is on prod and
-- slotted-killer migration 20261021000000_lineup_spotlight.sql has been applied to rickshaw-open-mic.
--
--   * Page /remote with an open_mic_signup block, view "remote": the lineup from the sheet with Next / Back; the
--     highlighted comic shows solid on /lineup and gets "You're up next!" on their own phone.
--   * A "Remote" tab at the end of the bar, shown only to the hosts (show_if "openmic-hosts", like Hosts).
--   * lineup_url on the Sign-Up block: this turns on the comics' show-day screen (Friday 6 AM until requests
--     reopen): "You're in!" / not-selected cards and the lineup. The "up next" card rides on that screen.
begin;
with app as (select id from apps where slug = 'stagetimepnw'),
signup as (
  select b.config from blocks b join pages p on p.id = b.page_id join app on app.id = p.app_id
  where b.type = 'open_mic_signup' and coalesce(b.config->>'view', 'signup') = 'signup'
),
pg as (
  insert into pages (app_id, name, path, position, is_home)
  select id, 'Remote', 'remote', 7, false from app
  returning id
)
insert into blocks (page_id, type, position, config)
select pg.id, 'open_mic_signup', 0,
       jsonb_build_object(
         'view', 'remote',
         'show_name', signup.config->>'show_name',
         'time_zone', signup.config->>'time_zone',
         'supabase_url', signup.config->>'supabase_url',
         'anon_key', signup.config->>'anon_key',
         'lineup_url', 'https://ldodkbdzljfpbnzrpxpu.supabase.co/functions/v1/lineup-feed')
from pg, signup;

update apps
set theme = jsonb_set(theme, '{bottom_nav}',
  (theme->'bottom_nav') || '[{"icon": "remote", "label": "Remote", "page_path": "remote", "show_if": "openmic-hosts"}]'::jsonb)
where slug = 'stagetimepnw';

update blocks b
set config = b.config || jsonb_build_object('lineup_url', 'https://ldodkbdzljfpbnzrpxpu.supabase.co/functions/v1/lineup-feed')
from pages p join apps a on a.id = p.app_id
where p.id = b.page_id and a.slug = 'stagetimepnw'
  and b.type = 'open_mic_signup' and coalesce(b.config->>'view', 'signup') = 'signup';
commit;
