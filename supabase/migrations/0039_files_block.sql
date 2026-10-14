-- A "Files" block: handouts, worksheets, menus as PDFs, forms, slides; anything visitors open or download. It holds only
-- labels and the addresses of files that are already in the public `app-assets` bucket (or anywhere else on the web),
-- so the only database change is allowing the new type name.

alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory', 'food_directory',
    'open_mic_signup', 'class_finder',
    'hero', 'price_list', 'hours', 'reviews', 'stats', 'gallery',
    'files'
  ));
