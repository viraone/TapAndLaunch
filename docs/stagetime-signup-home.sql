-- StageTime, 2026-10-18: the site opens on Sign-Up, and the tab bar is Sign-Up & Lineup + Profile.
-- The open mic list (Home) and Submit Your Open Mic leave the tab bar (they live on stagetimepnw.com);
-- their pages stay, so this can be undone by putting is_home back on 'home' and restoring the old bottom_nav.
begin;
update pages set is_home = (path = 'signup')
where app_id = (select id from apps where slug = 'stagetimepnw');

update apps
set theme = jsonb_set(theme, '{bottom_nav}', '[
  {"icon": "signup", "label": "Sign-Up & Lineup", "page_path": "signup"},
  {"icon": "profile", "label": "Profile", "page_path": "profile"}
]'::jsonb)
where slug = 'stagetimepnw';
commit;
