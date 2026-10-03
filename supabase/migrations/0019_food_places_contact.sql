-- LiveBites: phone number and website for the restaurant details sheet.
-- Google returns these in the same "Nearby Search Enterprise" tier as the rating and opening hours
-- we already request, so adding them to the field mask costs nothing extra. Additive and nullable:
-- places already stored fill in the next time their area is refreshed (lib/food/nearby.ts).

alter table public.food_places
  add column if not exists phone_national text,
  add column if not exists phone_international text,
  add column if not exists website text;
