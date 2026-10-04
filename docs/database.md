# Database (Supabase)

_Last checked: 2026-10-03._

## Two projects

| Project | Plan | Holds | Linked from this repo? |
|---|---|---|---|
| **TapAndLaunch** | Pro | Everything for TapAndLaunch: organizations, apps, pages, blocks, members, products, orders, Stripe accounts, push subscriptions, analytics, listings, gas and food data | **Yes.** `supabase link` points at it, so `supabase db push --linked` and `supabase db query --linked` hit **production** |
| **rickshaw-open-mic** | Free | The StageTime request list (`signups`), the comics' sign-in, settings, scheduled jobs, edge functions | No. Its migrations live in the StageTime repo. Use `--project-ref` to reach it |

## Migrations (TapAndLaunch)

Applied in order from `supabase/migrations/`. Production has every one of these (checked 2026-10-03 with
`supabase migration list --linked`).

| File | What it adds |
|---|---|
| 0001_init | Organizations, memberships (roles admin, creator, client), apps, pages, blocks, app members, analytics; helper functions `is_org_member`, `is_org_editor`, `is_org_admin` |
| 0002_storage | Storage bucket for uploaded images |
| 0003_form_submissions | Contact form submissions |
| 0004_members_and_gating | App member accounts, tiers, members-only blocks |
| 0005_notifications | Push subscriptions and notification sends |
| 0006_commerce_and_events | Products, orders and order items; events and bookings |
| 0007_custom_domains | Customers' own domains (Vercel Domains API) |
| 0008_booking_capacity | Stops overbooking events |
| 0009_api_grants | Grants newer Supabase no longer gives by default |
| 0010_listings, 0011_listing_directory_block | Open-mic listings and their directory block |
| 0012_create_organization_fn | Fix for creating an organization under row-level security |
| 0013_gas_stations | Gas prices block |
| 0014_food_places, 0015_food_fetch_groups | Live food block and its cost-saving fetch groups |
| 0016_open_mic_signup_block | StageTime sign-up block type |
| 0017_platform_admins_and_maps_gate | Platform admins; Google Maps features off per organization until enabled |
| 0018_stripe_connect | `stripe_accounts`; orders gain `payment_method`, Stripe ids, `paid_at`, statuses `paid` and `refunded` |
| 0019 to 0022 (food) | Restaurant phone/website, popular dishes, menu page, menu items |

### Writing a migration

- Next number, short name: `supabase/migrations/0023_something.sql`. Explain *why* in a comment at the top.
- Prefer additive changes (new tables, nullable columns). `/push` **stops** if a pending migration contains `drop table`,
  `drop column`, `drop schema`, `truncate` or `delete from`, so a person reviews it first.
- Update `src/types/database.ts` by hand to match (it is hand-written; see the README section on regenerating types).
- Test locally first: `supabase migration up` against the local database.

## Access rules (row-level security)

Every table has RLS on. The pattern:

- Dashboard reads and writes go through the signed-in builder's session, and RLS checks their organization role with
  `is_org_member` / `is_org_editor` / `is_org_admin`.
- Things a published app writes (orders, members, form submissions, bookings, push subscriptions) are written by server code
  with the **service-role key**, after the route validates the input. Shoppers and members are not Supabase Auth users.
- `stripe_accounts` can be **read** by organization members but has **no write policies**: only server code writes it, so an
  organization can never point itself at someone else's Stripe account.
- Order statuses `paid` and `refunded` are only ever set by Stripe-driven server code.

## Auth settings (TapAndLaunch project)

Set in the Supabase dashboard (Authentication), read back on 2026-10-03:

| Setting | Value |
|---|---|
| Site URL | `https://tapandlaunch.com` |
| Redirect URLs | `https://tapandlaunch.com/auth/callback`, `https://tapandlaunch.com/**`, `http://localhost:3100/auth/callback` |
| Email confirmation | Required (users click a link before they can sign in) |
| Minimum password length | **8** (raised from 6 on 2026-10-03; the signup form says the same) |
| Leaked-password protection | Off |
| SMTP | Resend (`smtp.resend.com`, port 465), sender `noreply@tapandlaunch.com`, name "TapAndLaunch" |
| Email rate limit | 30 per hour |
| Reset password email | Should use `supabase/templates/recovery.html` (subject "Reset your TapAndLaunch password"); until it is set, Supabase's default email is sent and its link only works in the browser that asked |

`supabase/config.toml` holds the **local** equivalents (it does not change production).

## Useful commands

```bash
supabase start                         # local database (needs Docker running)
supabase migration up                  # apply new local migrations
supabase migration list --linked       # compare local files with production
supabase db query --linked "select 1"  # run SQL on PRODUCTION (careful)
supabase db query --linked --project-ref <ref> "..."   # run SQL on another project (e.g. rickshaw-open-mic)
```
