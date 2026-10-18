-- Who set the DNS for an app's custom domain. 'namesilo' when the domain is in the platform's own NameSilo account
-- and the server wrote the records itself (lib/domains/namesilo.ts), so the builder says "set for you" instead of
-- showing records to add by hand. Null when the customer's registrar is somewhere else.
alter table public.apps add column custom_domain_dns text
  check (custom_domain_dns is null or custom_domain_dns in ('namesilo'));
