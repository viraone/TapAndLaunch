-- Three more sections for a website: a button (to a page or a web address), a quote, and a list of questions and
-- answers (an FAQ that opens and closes). They hold only text and addresses in `blocks.config`, so the only database
-- change is allowing the new type names.

alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory', 'food_directory',
    'open_mic_signup', 'class_finder',
    'hero', 'price_list', 'hours', 'reviews', 'stats', 'gallery',
    'files', 'button', 'quote', 'faq'
  ));
