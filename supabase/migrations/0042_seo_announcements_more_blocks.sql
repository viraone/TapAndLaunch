-- Search and sharing per page (a title, a description and a share picture of its own), and five more sections:
-- a picture beside words, a newsletter sign-up (which adds people to the app's members, so the Email channel can
-- write to them), a share bar, a map, and an audio player. Announcement bar and cookie notice live in `apps.theme`.

alter table public.pages
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists share_image_url text;

alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in (
    'text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar',
    'zoom_meeting', 'canva_embed', 'listing_directory', 'gas_directory', 'food_directory',
    'open_mic_signup', 'class_finder',
    'hero', 'price_list', 'hours', 'reviews', 'stats', 'gallery',
    'files', 'button', 'quote', 'faq',
    'image_text', 'newsletter', 'share', 'map', 'audio'
  ));
