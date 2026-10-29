-- StageTime: the Tally tab (hosts only) that shows the costume contest tally.
-- Run once in the TapAndLaunch project's SQL editor, AFTER the code with the "votes" block view is on prod.
-- Replace both placeholders first:
--   <PUBLISHED_TALLY_CSV_URL>  the Google Sheet's Tally tab, File > Share > Publish to web > Tally > CSV
--   <READER_EMAIL>             the one account that may read it (any host when left out of results_emails)
--
--   * Page /votes with an open_mic_signup block, view "votes". The page reads the CSV on the server, so the link
--     is never sent to the browser by the route, and only a signed-in host (and only <READER_EMAIL>) gets numbers.
--   * A "Tally" tab at the end of the bar, shown only to the hosts (show_if "openmic-hosts", like Remote).
-- Take it down after the contest: delete the page and the tab (see the end of this file) and, in the sheet,
-- File > Share > Publish to web > Stop publishing.
begin;
with app as (select id from apps where slug = 'stagetimepnw'),
signup as (
  select b.config from blocks b join pages p on p.id = b.page_id join app on app.id = p.app_id
  where b.type = 'open_mic_signup' and coalesce(b.config->>'view', 'signup') = 'signup'
),
pg as (
  insert into pages (app_id, name, path, position, is_home)
  select id, 'Tally', 'votes', 8, false from app
  returning id
)
insert into blocks (page_id, type, position, config)
select pg.id, 'open_mic_signup', 0,
       jsonb_build_object(
         'view', 'votes',
         'show_name', signup.config->>'show_name',
         'time_zone', signup.config->>'time_zone',
         'supabase_url', signup.config->>'supabase_url',
         'anon_key', signup.config->>'anon_key',
         'votes_csv_url', '<PUBLISHED_TALLY_CSV_URL>',
         'results_emails', jsonb_build_array('<READER_EMAIL>'))
from pg, signup;

update apps
set theme = jsonb_set(theme, '{bottom_nav}',
  (theme->'bottom_nav') || '[{"icon": "pumpkin", "label": "Tally", "page_path": "votes", "show_if": "openmic-hosts"}]'::jsonb)
where slug = 'stagetimepnw';
commit;

-- To take it down:
--   begin;
--   delete from pages where path = 'votes' and app_id = (select id from apps where slug = 'stagetimepnw');
--   update apps set theme = jsonb_set(theme, '{bottom_nav}',
--     (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(theme->'bottom_nav') e where e->>'page_path' <> 'votes'))
--   where slug = 'stagetimepnw';
--   commit;
