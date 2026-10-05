-- App members who clicked "Unsubscribe" in an email stop getting the Email channel (marketing-style
-- messages). Account and sign-in emails are separate and unaffected. Written by the published app's
-- /unsubscribe route through the service-role client.
alter table public.app_members add column email_unsubscribed_at timestamptz;
