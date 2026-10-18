-- StageTime, 2026-10-18: the first tab says "Home" (house icon, not the pencil) to the hosts (Viradeth, Nick, Noah) and stays "Sign-Up & Lineup" for
-- everyone else. label_if is read by the tab bar (src/components/pwa-runtime/PublishedBottomNav.tsx): while the browser's
-- "openmic-hosts" switch is on, the tab shows the label_if label. Run once in the TapAndLaunch project.
update apps
set theme = jsonb_set(theme, '{bottom_nav}', (
  select jsonb_agg(
    case when e->>'page_path' = 'signup'
         then e || '{"label_if": {"flag": "openmic-hosts", "label": "Home", "icon": "home"}}'::jsonb
         else e end
    order by ord)
  from jsonb_array_elements(theme->'bottom_nav') with ordinality as t(e, ord)))
where slug = 'stagetimepnw';
