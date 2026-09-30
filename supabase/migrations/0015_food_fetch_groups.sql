-- LiveBites: cuisine searches are fetched lazily, one Google call per
-- cuisine per grid cell the first time a viewer taps that pill, instead of
-- every cuisine up front. The cache ledger therefore tracks freshness per
-- (cell, group): 'all' is the general restaurant sweep, anything else is a
-- cuisine key from lib/food/cuisines.ts. Existing rows become the 'all'
-- group.

alter table public.food_fetch_cells
  add column fetch_group text not null default 'all';

alter table public.food_fetch_cells drop constraint food_fetch_cells_pkey;
alter table public.food_fetch_cells add primary key (app_id, cell_key, fetch_group);
