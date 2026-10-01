-- StageTime PNW's weekly showcase sign-up. The request list itself lives in
-- the show's own Supabase project (see OpenMicSignupBlockConfig), so this
-- only allows the new block type.
alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory', 'food_directory',
    'open_mic_signup'
  ));
