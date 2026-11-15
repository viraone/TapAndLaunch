-- StageTime: the bottom tab bar (Sign-Up & Lineup, Calendar) shows only after the visitor signs in with the 6-digit
-- code. Every tab that has no show_if yet gets show_if "openmic-signed-in" (the Hosts / Message the Hosts tabs keep
-- their own switches). Signed out, no tab passes, so the whole bar disappears.
-- Needs the code that sets the "openmic-signed-in" switch (host-chat.ts) on prod FIRST: run this after the push.
-- Run:  supabase db query --linked -f docs/stagetime-tabs-signed-in-only.sql
begin;
update apps
set theme = jsonb_set(
  theme,
  '{bottom_nav}',
  (
    select jsonb_agg(
      case when e ? 'show_if' then e else e || '{"show_if": "openmic-signed-in"}'::jsonb end
      order by ord
    )
    from jsonb_array_elements(theme->'bottom_nav') with ordinality as t(e, ord)
  )
)
where slug = 'stagetimepnw' and jsonb_typeof(theme->'bottom_nav') = 'array';
commit;
select theme->'bottom_nav' as bottom_nav from apps where slug = 'stagetimepnw';

-- OFF NOW (tabs back for everyone; the Hosts / Message the Hosts switches stay):
-- update apps set theme = jsonb_set(theme, '{bottom_nav}', (select jsonb_agg(case when e->>'show_if' = 'openmic-signed-in' then e - 'show_if' else e end order by ord) from jsonb_array_elements(theme->'bottom_nav') with ordinality as t(e, ord))) where slug = 'stagetimepnw';
