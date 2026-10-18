-- StageTime launch: the Profile page (Sign Out lives there) and the two new tabs.
begin;
with app as (select id from apps where slug = 'stagetimepnw'),
signup as (
  select b.config from blocks b join pages p on p.id = b.page_id join app on app.id = p.app_id
  where b.type = 'open_mic_signup' and coalesce(b.config->>'view', 'signup') = 'signup'
),
pg as (
  insert into pages (app_id, name, path, position, is_home)
  select id, 'Profile', 'profile', 3, false from app
  returning id
)
insert into blocks (page_id, type, position, config)
select pg.id, 'open_mic_signup', 0,
       jsonb_build_object('view', 'profile', 'supabase_url', signup.config->>'supabase_url', 'anon_key', signup.config->>'anon_key')
from pg, signup;

update apps
set theme = jsonb_set(theme, '{bottom_nav}', (theme->'bottom_nav') || '[
  {"icon": "signup", "label": "Sign-Up & Lineup", "page_path": "signup"},
  {"icon": "profile", "label": "Profile", "page_path": "profile"}
]'::jsonb)
where slug = 'stagetimepnw';
commit;
