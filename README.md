# Beezer — Phase 1 scaffold

A no-code, multi-tenant Progressive Web App builder (a Beezer-style product).
This repo is **Phase 1 of a phased build** — see [Scope](#scope--whats-deferred)
before assuming something is here that isn't.

## Stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui
- `@dnd-kit` for the builder's drag-and-drop canvas
- Supabase (Postgres + RLS, Auth, to be joined by Storage in a later phase)
- Zod for API route input validation

> **Next.js 16 note:** this scaffold uses a newer Next.js than most training
> data / tutorials reflect — `middleware.ts` is renamed to `proxy.ts`,
> `params`/`searchParams` are Promises everywhere, and there are new typed
> helpers (`PageProps`, `LayoutProps`, `RouteContext`). Check
> `node_modules/next/dist/docs/` before assuming an API from memory.
>
> **shadcn/ui note:** this registry generation is built on **Base UI**, not
> Radix — polymorphic composition is `<Button render={<Link .../>} />`, not
> `<Button asChild><Link /></Button>`.
>
> **Supabase package pins:** `@supabase/supabase-js` and `@supabase/ssr` are
> pinned to `2.109.0` / `0.7.0` (not `^latest`) because `@supabase/supabase-js
> >=2.110.0` requires Node 22, and this was scaffolded against Node 20. Both
> pinned versions use the same `getAll`/`setAll` cookie API this code is
> written against. If your deploy target is on Node 22+, upgrading both is a
> `npm install @supabase/supabase-js@latest @supabase/ssr@latest` away — no
> code changes needed unless a later major changes that cookie API.

## Getting started

1. Create a Supabase project.
2. Copy `.env.local.example` to `.env.local` and fill in the three Supabase
   values from Project Settings → API.
3. Link and push the schema:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
4. `npm install && npm run dev`
   (the first `dev`/`build` run also generates `.next/types`, which is where
   the ambient `PageProps`/`LayoutProps`/`RouteContext` helpers this repo
   uses come from — a bare `tsc --noEmit` on a fresh clone before that has
   run will fail to resolve them; run `npx next typegen` once if you need
   type-checking before your first `dev`/`build`.)
5. Visit `http://localhost:3000`, sign up, create an organization, create an
   app, and open its builder.
6. To preview a published app locally: publish it from the builder, then
   visit `http://{app-slug}.localhost:3000` (subdomains of `localhost` work
   in modern browsers, and with `curl -H "Host: {app-slug}.localhost:3000" http://localhost:3000`).

## Architecture

- **Multi-tenancy**: row-level (`organization_id` on every tenant-owned
  table) + Postgres RLS, not schema- or database-per-tenant. See
  `supabase/migrations/0001_init.sql` — RLS policies use three
  `SECURITY DEFINER` helper functions (`is_org_member`, `is_org_editor`,
  `is_org_admin`) instead of repeating `EXISTS` subqueries per policy.
- **Two Supabase identities, deliberately not unified**: dashboard users
  (org admins/creators) are real Supabase Auth users. End-users who sign up
  *inside* a published app (`app_members`) are not — a single Supabase
  project's `auth.users` isn't a good fit for arbitrary end-users across many
  tenants' apps. `app_members` is schema-ready but there's no signup/login
  UI for it yet (see below).
- **Subdomain routing**: `src/proxy.ts` rewrites `{slug}.$ROOT_DOMAIN/*` to
  `/published-apps/{slug}/*`. The render tree there (`src/app/published-apps/[appSlug]/...`)
  reads published content with the Supabase **service-role** client
  (`lib/supabase/admin.ts`), since anonymous visitors have no Supabase Auth
  session for RLS to check — draft apps 404 there by construction.
- **Builder → published app, one renderer**: `BlockRenderer` is shared
  between the builder's canvas and the published-app runtime, so what a
  creator sees while editing is what ships.

## Scope — what's deferred

Only what's needed to go from "empty repo" to "sign up, build a PWA with a
few block types, publish it, view it on a subdomain, with proper tenant
isolation" is built here. Deliberately **not** in this phase (all schema-
compatible to add later, none of it blocked by what's here):

- Custom domains + SSL provisioning (Vercel Domains API / Cloudflare for
  SaaS) — apps are only reachable on the platform's own wildcard subdomain.
  `apps.custom_domain` exists in the schema but is unused.
- Reseller white-labeling (custom branding/logo/footer) — `organizations.branding`
  exists in the schema but there's no UI for it.
- Web Push, SMS, email notifications — `analytics_events.event_type` already
  has `push_sent`/`push_opened` but nothing sends anything yet.
- `app_members` signup/login inside a published app (member tiers, gated
  content blocks).
- E-commerce/product listing, event/booking blocks, and the Shopify/Canva/Zoom
  integrations.
- Analytics dashboard UI — events are written (`view` on every page render)
  but nothing reads them back yet.
- Billing/subscriptions (Stripe), plan limits.
- File/image upload (Supabase Storage) — the image block takes a raw URL.
- Multi-org switching in the dashboard UI (a user can belong to more than one
  org per the schema; the dashboard only ever shows the first one).
- Background sync in the generated service worker (offline caching is there;
  background sync and push are commented TODOs in
  `app/published-apps/[appSlug]/sw.js/route.ts`).

## Regenerating Supabase types

`src/types/database.ts` is hand-written to match the migration (there's no
linked Supabase project yet to generate from). Once one is linked:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

Then re-apply the hand-written `jsonb` domain types (`BlockConfig`,
`ThemeConfig`, `ManifestConfig`, etc.) that the generator only knows as `Json`.
