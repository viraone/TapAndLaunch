# TapAndLaunch — Phase 1–6 scaffold

A no-code, multi-tenant Progressive Web App builder (a Beezer-style product, branded TapAndLaunch).
This repo covers **Phases 1–6 of a phased build** — see
[Scope](#scope--whats-deferred) before assuming something is here that isn't.

## Stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui
- `@dnd-kit` for the builder's drag-and-drop canvas
- Supabase (Postgres + RLS, Auth, Storage)
- Zod for API route input validation
- Hand-rolled inline-SVG charts for the analytics dashboard (no charting
  library dependency) — see `src/components/dashboard/charts/`
- `web-push` for Web Push/VAPID (the one real crypto library dependency in
  this repo — see the note in `lib/notifications/push.ts` on why, unlike
  password hashing or session tokens, this wasn't worth hand-rolling); email
  and SMS go straight to Resend's and Twilio's HTTP APIs via `fetch`, no SDK
  for either
- Custom domains via the **Vercel Domains API** (`lib/domains/vercel.ts`,
  plain `fetch` calls, no SDK) — the decision picked over Cloudflare for
  SaaS was Vercel specifically because this app is assumed to deploy there;
  see that file's own caveat on what hasn't been exercised against a real
  account

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
2. Copy `.env.local.example` to `.env.local`, fill in the three Supabase
   values from Project Settings → API, and generate `MEMBER_SESSION_SECRET`
   with `openssl rand -hex 32`. Notification channels are each optional —
   see the comments in `.env.local.example` for VAPID (push), Resend
   (email), and Twilio (SMS); leave any of them blank to leave that channel
   disabled (the compose UI marks it "not configured" instead of failing).
3. Link and push the schema (this also creates the `app-assets` Storage
   bucket used for image/icon/logo uploads — see `0002_storage.sql`):
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   The schema gives the API roles their table rights in `0009_api_grants.sql`, and every new table needs row-level security turned on.
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
7. Custom domains (Phase 6) only do anything once this app is actually
   deployed on Vercel — fill in `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID` (and
   `VERCEL_TEAM_ID` if the project belongs to a team) once it is. Until
   then, the builder's Settings → Domain tab reports "not configured"
   rather than failing oddly.

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
  tenants' apps. Members instead get their own session: a
  `scrypt`-hashed password (`lib/pwa/member-auth.ts`, Node's built-in
  `crypto` — no bcrypt/argon2 dependency) and an HMAC-signed session cookie
  (`lib/pwa/member-session.ts`) scoped to one app, verified against the DB on
  every request (`lib/pwa/get-current-member.ts`) rather than trusted from
  the token alone, so removing a member invalidates their session
  immediately rather than at cookie expiry.
- **Block-level gating, not a container block**: rather than a special
  "gated content" block wrapping others, *any* block can carry a
  `min_tier` (`blocks.min_tier` — public / any member / an exact tier-name
  match, set per-block in the builder's Inspector under "Visible to").
  Simpler than nested block containers, and doesn't require the schema to
  model block nesting at all.
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
- **One send route, three channels, no queue**: `/api/apps/[appId]/notifications/send`
  resolves recipients (`lib/notifications/recipients.ts` — "all members" or
  an exact tier match, same concept `blocks.min_tier` uses) and dispatches
  synchronously within the request (`Promise.allSettled`, not a background
  job) to whichever of push/email/SMS was selected. Fine at scaffold-scale
  recipient counts; a slow provider call at real scale would hold the
  request open for the whole batch — see Scope.
- **Send authorization isn't RLS**: unlike almost every other write in this
  repo, sending a notification is a side effect through the service-role
  client (calling Resend/Twilio/web-push), not an insert a table policy can
  gate. `lib/org.ts`'s `isAppEditor` does that check explicitly instead —
  still built from RLS-scoped reads (a non-member gets `false` the same way
  they'd get an empty/`null` row elsewhere), just not a policy itself.
- **A stale push subscription self-heals**: a 404/410 from the push service
  means the browser subscription is gone (site data cleared, uninstalled,
  etc.) — the send route deletes that `push_subscriptions` row itself
  rather than leaving it to fail forever on every future send.
- **Products and events are "show everything," not per-block curation**:
  there's exactly one active-products list and one upcoming-events list per
  app — the `product_list`/`event_calendar` blocks always show all of it,
  with no per-block product/event picker. Simpler than building a
  multi-select UI, and it's the same simplification `min_tier` gating
  already made for blocks in general (whole-block, not partial content).
- **An order is one product, not a cart**: `ProductBuyRuntime` creates one
  order with one line item per "Buy" click — there's no multi-item basket
  to check out at once. `orders`/`order_items` are still modeled as
  order-with-line-items (not a flattened single-product row) so a real cart
  can be layered on later without a schema change, just a different write
  path.
- **No payment processor**: an order is a purchase *request*
  (`orders.status` starts `'pending'`) a merchant follows up on manually —
  Stripe integration is Phase 7's job. Naming avoids "paid"/"payment"
  anywhere in the schema or code for this reason.
- **Zoom/Canva are link embeds, not API integrations**: matching the
  original spec's own wording ("meeting link embeds", "embed/button widget
  integration") — no OAuth app, no calling out to either service's API.
  Creating/managing the actual Zoom meeting or Canva design still happens
  in Zoom/Canva; these blocks just render the link a creator pastes in.
- **A custom domain is additional, not a replacement**: adding one to an
  app doesn't disable its `{slug}.$ROOT_DOMAIN` subdomain — both keep
  serving the same app. That subdomain also still works as a stable
  preview/fallback link, which is why this isn't framed as a limitation.
  One consequence worth knowing: they're different browser origins, so an
  `app_members` session started on one won't carry over to the other.
- **The custom-domain lookup is the one place `proxy.ts` touches the
  database**: `resolveAppSlugForHost` (`lib/tenant.ts`) tries the DB-free
  subdomain check first and only falls back to a `custom_domain` query for
  hosts that don't match `{slug}.$ROOT_DOMAIN` — so ordinary subdomain
  traffic never pays for a query it doesn't need, and a DB hiccup on that
  fallback degrades to "no tenant" (falls through to the marketing/
  dashboard routes) rather than a 500.
- **Verified + published, not just verified**: `resolveAppSlugForHost` only
  resolves a `custom_domain` whose `custom_domain_status = 'verified'` *and*
  whose app `status = 'published'` — an app mid-DNS-verification, or a
  since-unpublished one, can't become reachable just because DNS already
  points at it.
- **The Vercel API call happens before the authorization check would
  otherwise fail it**: sending a notification and adding/removing a custom
  domain are the two places in this repo where an *external* side effect
  (calling Resend/Twilio/web-push, or Vercel's API) isn't itself gated by
  RLS. Both explicitly check `isAppEditor` (`lib/org.ts`) first, rather
  than letting the side effect happen and only the subsequent DB write
  fail — see the comment in `api/apps/[appId]/domain/route.ts` for why
  that ordering specifically matters here (a non-editor could otherwise
  trigger a real Vercel API call, quota and all, with no lasting DB effect
  to show for it).

### Gas prices block (GasPal)

The `gas_directory` block turns any app into a "cheapest gas near me" PWA
(the first tenant using it is GasPal, `gaspal.tapandlaunch.com`).

- **Live location, not a hard-coded one**: `GasDirectoryRuntime` asks the
  browser for the viewer's GPS position and searches around *that*; the
  block's configured coordinates are only a fallback for when permission
  is denied. Distances are haversine from the viewer.
- **Per-station prices come from Google Places API (New)** — the
  `fuelOptions` field of `places:searchNearby` (`lib/gas/google.ts`),
  which returns each station's current price per grade with a timestamp.
  This is the one paid dependency: the Enterprise + Atmosphere SKU, 1,000
  calls/month free. `GOOGLE_MAPS_API_KEY` is server-only (never
  `NEXT_PUBLIC_`), restricted to the Places API (New) in Google Cloud.
- **Caching keeps the bill near zero**: results are stored in
  `gas_stations` and the map is split into ~1 mi cells
  (`gas_fetch_cells`, 60-minute TTL) — a second viewer in the same cell
  within the hour is served from the DB, not Google. A daily ledger
  (`gas_fetch_budget`, 200 calls/day) hard-stops further Google calls;
  past it, or with no key configured, `lib/gas/overpass.ts` falls back to
  OpenStreetMap for station *locations* (no prices).
- **Crowd-sourced corrections**: "Update price" and "Add station" submit
  to `/gas/prices` and `/gas/stations` with `price_source = 'user'`; a
  user price wins over Google's until Google reports something newer.
- Editors manage and delete stations at Dashboard → app → Manage → Gas
  stations. Schema: `0013_gas_stations.sql`.

### Live food block (LiveBites)

The `food_directory` block is a real-time "what's open near me" restaurant
directory (first tenant: LiveBites).

- **Live status without live polling**: Google Places (New) supplies each
  restaurant's full weekly `regularOpeningHours` and `utcOffsetMinutes`;
  `lib/food/hours.ts` evaluates them in the restaurant's own time zone to
  produce Open (with closing time), Closing soon (≤ 30 min, with a
  countdown) or Closed (with the next opening, "11 AM" / "Wed 11 AM"). The
  published app re-evaluates every 30 s, so countdowns tick with zero
  network traffic. Covered by `hours.test.ts` (after-midnight closes,
  week wrap, 24/7, unknown hours).
- **Cuisine quick-filters** (Ramen, Pho/Vietnamese, Thai, Korean,
  Japanese, Mexican/Tacos, Pizza, Burgers, Mediterranean, Ethiopian,
  Indian, Bars & Pub Grub, Dessert/Coffee — `lib/food/cuisines.ts`, each
  a set of Google types plus name keywords). Searches are lazy: an area
  costs one Nearby Search (the general sweep) and each cuisine's own
  search runs the first time a viewer taps its pill (`?cuisine=` on
  `/food/nearby`). Freshness is per (cell, group) in `food_fetch_cells`
  and trusted for a week; a daily budget (`food_fetch_budget`, 200
  calls) caps spend. Enterprise SKU, 1,000 free calls/month,
  `GOOGLE_MAPS_API_KEY` server-only.
- The runtime no longer offers wait reporting (dropped from the UI on
  2026-09-30); `/food/wait` and `food_wait_reports` remain but are unused.
- Cuisines show as a grid of tiles ("What are you craving?", six plus a
  More tile), with a name search and Open / Nearest sort in a sticky bar.
  Tapping a place opens Google Maps directions with the place id. Schema:
  `0014_food_places.sql`, `0015_food_fetch_groups.sql`.

## Scope — what's deferred

Phase 6 adds custom domains (Vercel Domains API) on top of Phase 5's
commerce/events. Deliberately **not** in this phase (all schema-compatible
to add later, none of it blocked by what's here):

- **Not exercised against a real Vercel account** — see the caveat in
  `lib/domains/vercel.ts`. Implemented against Vercel's documented REST API
  shape (add domain → DNS records returned if unverified → re-verify →
  remove), but there were no credentials available to actually test the
  flow end-to-end. Double-check response shapes against Vercel's current
  API reference before relying on this in production.
- Cloudflare for SaaS was the alternative considered and not built — if
  this app ever needs to run somewhere other than Vercel, that's a
  from-scratch addition (a different provisioning flow entirely, not an
  extension of `lib/domains/vercel.ts`), not a small swap.
- No automatic verification polling — the dashboard's "Check verification"
  is a manual button, not a background job that notices DNS propagated and
  updates the status on its own.
- No canonical redirect between an app's subdomain and its custom domain
  once verified (deliberate, not just deferred — see the "additional, not
  a replacement" architecture note) and no per-domain SEO
  canonical-URL/sitemap handling for the two-hostnames-one-app case.
- No confirmation step before removing a domain, and no history of past
  domains an app has used.
- A fully white-labeled reseller **portal** (its own domain, fully re-skinned
  for an agency's own clients) — `organizations.branding` is editable
  (`/dashboard/settings`) and the logo shows in the dashboard header, but
  `primary_color`/`footer_text` aren't applied anywhere yet; there's no
  separate reseller-facing surface to apply them to.
- A send queue/background job for notifications — see the "one send route,
  three channels, no queue" architecture note. Fine until either a send has
  enough recipients to matter, or a provider's own rate limits start
  rejecting a large batch sent all at once.
- Rich notification composition: plain title/body only, no images, action
  buttons, or scheduling ("send this at 6pm") — a notification goes out the
  moment "Send" is clicked.
- Member notification preferences (e.g. opt out of email but stay on push) —
  a member can revoke *push* themselves (the "Disable notifications"
  button), but there's no per-channel unsubscribe for email/SMS beyond an
  admin removing their phone/deleting them from
  `/dashboard/apps/[appId]/members`.
- Member account recovery: no email verification on signup, no "forgot
  password" flow, no email uniqueness check beyond the DB constraint
  surfacing as a generic error. A member who forgets their password has no
  way back in yet.
- Tiers are flat strings, not a ranked hierarchy — a block's `min_tier`
  (or a notification's tier target) either matches a member's `tier`
  exactly or it's `"*"` (any member) or unset (public/everyone). There's no
  "premium includes everything basic includes" inheritance, and no
  tier-management UI beyond typing a tier name into a block's Inspector, the
  notification composer's audience picker, or a member's row in
  `/dashboard/apps/[appId]/members`.
- No paid-tier enforcement — `app_members.tier` is set by hand from the
  dashboard; there's no checkout flow that assigns it (that's Phase 7's
  billing work, once it exists).
- No real payment processing (Stripe is Phase 7) — see the "no payment
  processor" architecture note. Orders are purchase requests, not
  transactions.
- No product variants or inventory tracking — one price per product, no
  size/color options, no stock counts or oversell prevention.
- No per-block product/event curation (see the "show everything" note) — a
  merchant with two very different product lines can't split them across
  two `product_list` blocks on different pages.
- Shopify/Canva-as-API-integration/Zoom-as-API-integration: Canva and Zoom
  are link embeds only (see the architecture note); Shopify isn't
  integrated at all — the product catalog is this repo's own
  (`products`/`orders`/`order_items`), not synced from a connected Shopify
  store. Layering Shopify in as an *additional* import source into the same
  `products` table, rather than replacing it, is the natural way to add
  that later without reworking the block.
- Billing/subscriptions (Stripe), plan limits.
- Background sync in the generated service worker (offline caching and Web
  Push are both there now; background sync — e.g. retrying a queued offline
  form submission — is a commented TODO in
  `app/published-apps/[appSlug]/sw.js/route.ts`, and is unrelated to push).
- Rate limiting / spam filtering on every public write endpoint on the
  published-app runtime (contact-form submit, member signup/login, push
  subscribe, order/booking creation) — fine for a scaffold, not for a
  public deployment.
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
