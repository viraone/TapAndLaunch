-- LiveBites: show a restaurant's own menu inside the app. Google has no menu data, so the server looks at
-- the restaurant's website once a month (lib/food/menuLookup.ts): finds its "Menu" page and checks whether the
-- site allows being shown inside another page. Only the result is stored. Additive and nullable.

alter table public.food_places
  add column if not exists menu_url text,
  add column if not exists menu_embeddable boolean,
  add column if not exists menu_checked_at timestamptz;
