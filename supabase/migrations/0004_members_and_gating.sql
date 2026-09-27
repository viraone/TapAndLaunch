-- Phase 3: member accounts (end-users who sign up inside a published app)
-- and per-block gating by member tier.

-- ---------------------------------------------------------------------------
-- Block-level gating. `min_tier` is free text, not a foreign key into a
-- tiers table — there is no separate tier-management surface (see the
-- README's Phase 3 notes); it's matched against `app_members.tier` at
-- render time by application code, not by a DB constraint, with two
-- reserved meanings the app layer interprets:
--   null / ''  -> public, no gate
--   '*'        -> any signed-in member, regardless of tier
--   anything else -> member.tier must equal this string exactly
-- ---------------------------------------------------------------------------
alter table public.blocks add column min_tier text;

-- ---------------------------------------------------------------------------
-- app_members write policies for the dashboard (edit a member's tier, or
-- remove one). The Phase 1 migration only granted org members a SELECT
-- policy — writes were exclusively the service-role signup path. This adds
-- the org-editor write path without changing that: end-user signup still
-- goes through the service role (app_members has no INSERT policy for the
-- anon/authenticated roles, and still doesn't after this migration).
-- ---------------------------------------------------------------------------
create policy "org editors can update their apps' members"
  on public.app_members for update
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)))
  with check (public.is_org_editor((select organization_id from public.apps where id = app_id)));

create policy "org editors can delete their apps' members"
  on public.app_members for delete
  using (public.is_org_editor((select organization_id from public.apps where id = app_id)));
