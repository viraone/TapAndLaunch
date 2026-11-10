-- StageTime: the host's "Remote" tab becomes "Timer" with a stopwatch icon. Run AFTER the code with the `timer` tab icon
-- (BottomNav TAB_ICON_PATHS) is live. page_path stays "remote": only the label, the icon and the browser-tab title change.
-- Run in the Supabase SQL editor of the tapandlaunch project (prod, Viradeth only).

-- 1. See the tab bar and the page title you are about to change.
select a.slug, jsonb_pretty(a.theme->'bottom_nav') as bottom_nav from apps a where a.slug = 'stagetimepnw';
select p.path, p.name from pages p join apps a on a.id = p.app_id where a.slug = 'stagetimepnw' and p.path = 'remote';

-- 2. Relabel the tab (keeps every other tab and the order).
update apps a
set theme = jsonb_set(
  a.theme, '{bottom_nav}',
  (select jsonb_agg(case when e->>'page_path' = 'remote' then e || '{"label":"Timer","icon":"timer"}'::jsonb else e end order by ord)
   from jsonb_array_elements(a.theme->'bottom_nav') with ordinality as t(e, ord))
)
where a.slug = 'stagetimepnw';

-- 3. The browser-tab title of that page.
update pages p set name = 'Timer'
from apps a
where a.id = p.app_id and a.slug = 'stagetimepnw' and p.path = 'remote';

-- 4. Turn it back: the same two updates with "Remote" / "remote" in place of "Timer" / "timer".
