-- The builder and the save route learn block types from BLOCK_TYPES (src/lib/builder/block-defaults.ts); the
-- database keeps the same list. Replace the previous rule with the current 29 types plus web_page.
alter table public.blocks drop constraint if exists blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory', 'food_directory',
    'open_mic_signup', 'class_finder',
    'hero', 'price_list', 'hours', 'reviews', 'stats', 'gallery',
    'files', 'button', 'quote', 'faq',
    'image_text', 'newsletter', 'share', 'map', 'audio',
    'group_chat', 'web_page'
  ));
