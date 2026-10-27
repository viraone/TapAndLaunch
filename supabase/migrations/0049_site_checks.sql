-- Site check: the public "check my site" page runs a quick technical SEO audit of any address a visitor types, then saves the
-- finished report so the same site is not crawled again for an hour (the route replays the saved report) and the report page can
-- render it later.
--
-- Unlike most tables here there is no owner: a visitor checks a site without signing in, so the rows are keyed only by a hash of
-- the visitor's address. The table is written by the service-role site-check route and read by the service-role report route, so it
-- has no policies on purpose. `host` is the checked site's host lower-cased and without "www.", so the cooldown replay can find the
-- last finished check of the same site.
create table public.site_checks (
  id uuid primary key default gen_random_uuid(),
  -- The site's host, lower-case and without "www." (e.g. "example.com"), used for the per-host cooldown.
  host text not null,
  -- The normalised address that was checked (always http:// or https://).
  site text not null,
  -- Out of 100. Null when the site could not be checked at all (see unreadable_reason).
  score integer,
  grade text,
  page_count integer not null default 0,
  -- The full engine report, exactly as the audit returned it.
  report jsonb not null,
  -- Length of the report's fix-first list, so the report page does not need to parse jsonb to count it.
  fix_count integer not null default 0,
  -- report.unreadable?.reason: why the site could not be checked, or null when it was.
  unreadable_reason text,
  -- sha256 of the visitor's address plus a server secret, so the raw address is never stored.
  visitor_hash text not null,
  -- Optional, filled by a later route when the visitor asks for the report by email.
  email text,
  duration_ms integer not null,
  created_at timestamptz not null default now()
);

create index site_checks_host_created_idx on public.site_checks(host, created_at desc);

alter table public.site_checks enable row level security;

-- No policies on purpose: only the service-role routes under site-check/ read or write it.
