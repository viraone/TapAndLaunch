-- StageTime: the Thanksgiving Leftovers banner takes the logo's place in the header (sign-up page and every page that
-- shows the header) until the end of Fri 2026-11-27 (Seattle date). Tapping it opens the Eventbrite page.
-- Needs the code with theme.header_banner on prod. After 2026-11-27 the logo comes back by itself; the key can stay.
-- Run:  supabase db query --linked -f docs/stagetime-header-banner.sql
begin;
update apps
set theme = jsonb_set(theme, '{header_banner}', '{
  "label": "Food drive · Fri Nov 27",
  "title": "Thanksgiving Leftovers",
  "sub": "Free with a food donation · Ballard Food Bank",
  "button": "Get tickets →",
  "image": "https://tapandlaunch.com/promos/thanksgiving-leftovers.jpg",
  "chips": [
    {"text": "Seating 6:30 · Show 7:30", "icon": "clock"},
    {"text": "Karaoke after", "icon": "mic"}
  ],
  "url": "https://www.eventbrite.com/e/thanksgiving-leftovers-tickets-2004679289720",
  "until": "2026-11-27"
}'::jsonb)
where slug = 'stagetimepnw';
commit;
select theme->'header_banner' as header_banner from apps where slug = 'stagetimepnw';

-- OFF NOW (logo back at once):
-- update apps set theme = theme - 'header_banner' where slug = 'stagetimepnw';
