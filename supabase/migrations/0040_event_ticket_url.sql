-- A ticket link on an event. A comedian's shows (and many venues' events) sell tickets on Eventbrite or the venue's
-- site, not through the app: with a link set, the event shows a "Tickets" button that opens it, instead of the in-app
-- booking form. Additive: null means "book here", as before.

alter table public.events add column if not exists ticket_url text;
