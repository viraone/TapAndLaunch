-- Six blocks that make a starter app look like a real business on first open: a photo banner, a menu or price
-- list, opening hours with address and phone, reviews, a strip of short highlights, and a photo gallery. They hold
-- only text and image addresses in `blocks.config`, so the only database change is allowing the new type names.

alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory', 'food_directory',
    'open_mic_signup', 'class_finder',
    'hero', 'price_list', 'hours', 'reviews', 'stats', 'gallery'
  ));
