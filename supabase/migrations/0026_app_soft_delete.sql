-- Deleting an app: hidden at once, erased for good after 30 days, restorable by an admin until then.
--
-- `deleted_at` marks a deleted app. The select policy now hides deleted apps from everyone, and because
-- every child table's policy looks the app up through this same policy, a deleted app's pages, blocks,
-- members, orders and so on disappear from the dashboard too, with no change to those queries. The server
-- (service role) is the only thing that can see, restore or erase a deleted app. A deleted app is also
-- unpublished and its custom domain is detached (by the delete route), so it stops being served.
--
-- The app's slug stays reserved while it is in the 30-day window, so a restore never collides with a new app.
-- The 30 here must match APP_RESTORE_DAYS in src/lib/apps/deletion.ts.
alter table public.apps
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id) on delete set null;

create index apps_deleted_at_idx on public.apps(deleted_at) where deleted_at is not null;

drop policy "org members can read their apps" on public.apps;
create policy "org members can read their apps"
  on public.apps for select
  using (public.is_org_member(organization_id) and deleted_at is null);

-- Erase apps 30 days after they were deleted (cascades to everything inside them). Runs daily at 03:15 UTC.
create extension if not exists pg_cron;

select cron.schedule(
  'purge-deleted-apps',
  '15 3 * * *',
  $$ delete from public.apps where deleted_at is not null and deleted_at < now() - interval '30 days' $$
);
