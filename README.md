# Beezer — Phase 1 + 2 scaffold

A no-code, multi-tenant Progressive Web App builder (a Beezer-style product).
This repo covers **Phases 1–2 of a phased build** — see
[Scope](#scope--whats-deferred) before assuming something is here that isn't.

## Stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui
- `@dnd-kit` for the builder's drag-and-drop canvas
- Supabase (Postgres + RLS, Auth, Storage)
- Zod for API route input validation
- Hand-rolled inline-SVG charts for the analytics dashboard (no charting
  library dependency) — see `src/components/dashboard/charts/`

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
3. Link and push the schema (this also creates the `app-assets` Storage
   bucket used for image/icon/logo uploads — see `0002_storage.sql`):
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
  creator sees while editing is what ships. The one exception is the
  contact-form block, split into its own Client Component
  (`ContactFormRuntime`) so it can actually submit — everything else stays a
  plain server-rendered view.
- **Active org via cookie, not URL**: `active_org_id` (`src/lib/org.ts`)
  tracks which org a multi-org user is currently viewing. Set on org
  creation and by the switcher; falls back to the user's first membership if
  unset or stale (e.g. pointing at an org they've since left).
- **Uploads via one public bucket, not one per tenant**: `app-assets`
  (`0002_storage.sql`), objects path-prefixed `{organization_id}/...`; RLS on
  `storage.objects` gates writes to that org's editors, reads are public
  (everything stored here ends up visible on a published app or as a
  logo/icon anyway).
- **Analytics palette**: chart colors (`--chart-1..5` in `globals.css`) are
  the dataviz skill's validated reference palette, not shadcn's default
  grayscale placeholders — swap these if/when there's an actual brand
  palette to validate instead.

## Scope — what's deferred

Only what's needed to get from a working Phase 1 scaffold to "the builder is
actually usable end to end — real image/icon uploads, real theming, an org
you can rebrand, multiple orgs per user, contact forms that go somewhere, and
basic analytics" is built in Phase 2. Deliberately **not** in this phase (all
schema-compatible to add later, none of it blocked by what's here):

- Custom domains + SSL provisioning (Vercel Domains API / Cloudflare for
  SaaS) — apps are only reachable on the platform's own wildcard subdomain.
  `apps.custom_domain` exists in the schema but is unused.
- A fully white-labeled reseller **portal** (its own domain, fully re-skinned
  for an agency's own clients) — `organizations.branding` is editable
  (`/dashboard/settings`) and the logo shows in the dashboard header, but
  `primary_color`/`footer_text` aren't applied anywhere yet; there's no
  separate reseller-facing surface to apply them to.
- Web Push, SMS, email notifications — `analytics_events.event_type` already
  has `push_sent`/`push_opened` but nothing sends anything yet.
- `app_members` signup/login inside a published app (member tiers, gated
  content blocks).
- E-commerce/product listing, event/booking blocks, and the Shopify/Canva/Zoom
  integrations.
- Billing/subscriptions (Stripe), plan limits.
- Background sync in the generated service worker (offline caching is there;
  background sync and push are commented TODOs in
  `app/published-apps/[appSlug]/sw.js/route.ts`).
- Rate limiting / spam filtering on the public contact-form submit endpoint
  (`app/published-apps/[appSlug]/submit/route.ts`) — fine for a scaffold,
  not for a public deployment.
- The analytics date-range filter is a full page navigation (Link + query
  param), not a client-side refetch that holds the previous render while
  loading — simpler, but doesn't follow the dataviz skill's "refetch keeps
  the frame" guidance for a SPA-style filter.

## Regenerating Supabase types

`src/types/database.ts` is hand-written to match the migration (there's no
linked Supabase project yet to generate from). Once one is linked:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

Then re-apply the hand-written `jsonb` domain types (`BlockConfig`,
`ThemeConfig`, `ManifestConfig`, etc.) that the generator only knows as `Json`.
