-- StageTime on Beezer: the open-mic directory block. The same eight types as 0006, plus 'listing_directory'.
alter table public.blocks drop constraint blocks_type_check;
alter table public.blocks add constraint blocks_type_check
  check (type in ('text', 'image', 'video', 'contact_form', 'product_list', 'event_calendar', 'zoom_meeting', 'canva_embed', 'listing_directory'));
