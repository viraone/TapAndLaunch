-- A domain can be bought on its own, from tapandlaunch.com/domains, before there is a site to put it on (or for a site
-- built later). Such an order has no app until the customer connects it from Dashboard > Domains or a site's Domain tab.
alter table public.domain_orders alter column app_id drop not null;
