-- Phase 2: Supabase Storage for tenant-uploaded images (block images, app
-- icons, org logos). One public bucket, scoped by an `{organization_id}/...`
-- path prefix rather than one bucket per tenant — buckets are a fixed,
-- managed resource in Supabase, not something to create per-org at runtime.
--
-- `public: true` means objects are readable via their public URL with no
-- RLS check at all (this is fine: everything stored here is either already
-- shown on a published PWA anyone can visit, or a logo/icon that isn't
-- sensitive). RLS below only gates writes (insert/update/delete).

insert into storage.buckets (id, name, public)
values ('app-assets', 'app-assets', true)
on conflict (id) do nothing;

-- `storage.foldername(name)` splits the object path on '/'; the first
-- segment is the organization_id by convention (enforced here, not by the
-- bucket itself) — every upload path must start with `{organization_id}/`.
-- A path whose first segment isn't a valid uuid makes the `::uuid` cast
-- raise rather than just evaluate false, which aborts the request with a
-- Postgres error instead of a clean policy-denied response — acceptable for
-- Phase 2 (the upload client always controls this path), but worth knowing
-- if a future caller ever accepts an arbitrary path from user input.
create policy "org editors can upload to their org's folder"
  on storage.objects for insert
  with check (
    bucket_id = 'app-assets'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

create policy "org editors can update their org's files"
  on storage.objects for update
  using (
    bucket_id = 'app-assets'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

create policy "org editors can delete their org's files"
  on storage.objects for delete
  using (
    bucket_id = 'app-assets'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );
