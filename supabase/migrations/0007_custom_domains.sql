-- Phase 6: custom domains, provisioned via the Vercel Domains API
-- (lib/domains/vercel.ts). `apps.custom_domain` already existed from
-- Phase 1 (schema-ready, unused) — this adds the status/verification
-- bookkeeping needed to actually drive it.

alter table public.apps add column custom_domain_status text
  check (custom_domain_status is null or custom_domain_status in ('pending', 'verified', 'error'));

-- The DNS records Vercel asks the tenant to add (type/domain/value/reason),
-- shown verbatim in the dashboard's domain settings until verification
-- succeeds. Application-level shape (see lib/domains/vercel.ts), not
-- constrained here — this is third-party API response data passed through,
-- not something this schema should encode the shape of.
alter table public.apps add column custom_domain_verification jsonb not null default '[]'::jsonb;
