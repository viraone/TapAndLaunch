-- Newer Supabase no longer grants the API roles (anon, authenticated,
-- service_role) rights on tables by default, so every supabase-js query fails
-- with "permission denied for table …" on a fresh database. These grants give
-- the API roles their table-level rights; row-level security stays what decides
-- which rows each role sees — so every new table must turn RLS on and add its
-- own policies.

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
