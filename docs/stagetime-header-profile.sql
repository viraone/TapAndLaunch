-- StageTime: Profile moves from the bottom bar to a round icon in the header's top-right corner, on every page, for
-- everyone (comics and hosts). Needs the code with theme.header_action on prod. The /profile page itself is untouched.
-- Run:  supabase db query --linked -f docs/stagetime-header-profile.sql
begin;
update apps
set theme = jsonb_set(
  theme || '{"header_action": {"label": "Profile", "icon": "profile", "page_path": "profile"}}'::jsonb,
  '{bottom_nav}',
  (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(theme->'bottom_nav') e where e->>'page_path' <> 'profile'))
where slug = 'stagetimepnw';
commit;
select theme->'header_action' as header_action, (select string_agg(e->>'label', ' · ') from jsonb_array_elements(theme->'bottom_nav') e) as tabs
from apps where slug = 'stagetimepnw';

-- UNDO (Profile back in the bar, before Remote; no corner link):
-- update apps set theme = jsonb_set(theme - 'header_action', '{bottom_nav}',
--   (select jsonb_agg(e) from (select e from jsonb_array_elements(theme->'bottom_nav') e where e->>'page_path' <> 'remote' and e->>'page_path' <> 'votes'
--      union all select '{"icon": "profile", "label": "Profile", "page_path": "profile"}'::jsonb
--      union all select e from jsonb_array_elements(theme->'bottom_nav') e where e->>'page_path' in ('remote', 'votes')) s))
-- where slug = 'stagetimepnw';
