-- LiveBites: "Popular with diners" on the restaurant details sheet.
-- Dishes are matched from a restaurant's recent 4-5 star Google reviews (lib/food/dishes.ts). Only the
-- result is stored (dish, emoji, how many reviews mention it), never the review text, and it is
-- remembered for 30 days so each restaurant costs at most one Google call a month.
-- Review text is Google's "Place Details Enterprise + Atmosphere" tier (1,000 free calls a month), so
-- calls are also counted per app per month and stop at a cap well below that (see lib/food/popularDishes.ts).
-- Additive and nullable.

alter table public.food_places
  add column if not exists popular_dishes jsonb,
  add column if not exists dishes_synced_at timestamptz;

create table if not exists public.food_dish_budget (
  app_id uuid not null references public.apps(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  calls integer not null default 0,
  primary key (app_id, month)
);

alter table public.food_dish_budget enable row level security;
