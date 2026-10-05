# Plans and billing (what customers pay TapAndLaunch)

_Last checked: 2026-10-05._ Not to be confused with `stripe-payments.md`, which is about shoppers paying our customers.

## The plan
One plan (constants in `src/lib/billing/plans.ts`):

| | |
|---|---|
| Name | Standard |
| Price | **$10/month**, or **$100/year** (saves $20). Set in `PLAN` in `src/lib/billing/plans.ts` |
| Trial | 30 days, no card, starts when an organization is created |
| Included | Everything (no limits are enforced yet) |

Prices are Stripe Prices found by **lookup key** (`tapandlaunch_standard_monthly` / `_yearly`) and created on first use
(`ensurePrices`), so sandbox and live both work from the same code with no price ids to copy. If the amount in `PLAN`
changes, `ensurePrices` creates a new Stripe Price and moves the lookup key to it (Stripe prices can't be edited);
people already subscribed keep the price they signed up at.

## Data
`org_billing` (migration 0025), one row per organization: `status` (`trialing`, `active`, `past_due`, `canceled`,
`complimentary`), `trial_ends_at`, Stripe customer and subscription ids, interval, `current_period_end`,
`cancel_at_period_end`. Org members can read it; **only server code writes it**, so an organization can never give itself
a plan. (It is a separate table because org admins can update their own `organizations` row.)

- A trigger starts a 30-day trial on every new organization.
- Every organization that existed when 0025 ran is **`complimentary`** (free, never locked out). To make someone free:
  `update org_billing set status = 'complimentary' where organization_id = '...'`.

## How it works
1. **Settings > Plan & billing** shows where the organization stands. Admins pick Yearly or Monthly.
2. `POST /api/billing/checkout` opens Stripe Checkout (subscription mode) on **our own** Stripe account. Subscribing
   mid-trial keeps the days left (`trial_end`; skipped when under 49 hours, which Stripe does not allow).
3. Back on `/dashboard/settings?billing=success`, the page asks Stripe for the subscription and saves it
   (`syncOrgSubscription`), so it is right immediately. (The page reads the row with the service-role client on purpose:
   Next reuses identical GET requests in one render, and the layout reads the same row first.)
4. **Webhook** `POST /api/stripe/billing-webhook` (secret `STRIPE_BILLING_WEBHOOK_SECRET`) keeps it right afterwards:
   `customer.subscription.created/updated/deleted` and `checkout.session.completed`. This is a *separate* endpoint from
   `/api/stripe/webhook` (Connect events) and listens to **your own account**, not connected accounts.
5. **Manage billing** (`POST /api/billing/portal`) opens Stripe's customer portal: change card, switch plan, cancel.

Stripe status to ours: `active`/`trialing` -> `active`; `past_due`/`unpaid`/`incomplete` -> `past_due`; anything else ->
`canceled`.

## Enforcement (off by default)
`BILLING_ENFORCED=true` in Vercel makes published apps show "is taking a break" when their organization is out of good
standing: trial over, plan canceled and its paid period ended, or a failed payment older than 7 days (counted from the
row's last change). With the variable unset **nothing is ever paused**; the dashboard still shows the trial banner and
the plan card. Turn it on only after live billing works end to end.

The dashboard banner (`bannerFor`) appears in the last 7 days of a trial, after it ends, on a failed payment and after
a cancellation.

## Going live checklist (billing)
1. Live Stripe keys in Vercel (see `go-live-checklist.md`), redeploy.
2. In Stripe **live** mode: create a webhook endpoint to `https://tapandlaunch.com/api/stripe/billing-webhook` on **your
   account**, events listed above; put its secret in `STRIPE_BILLING_WEBHOOK_SECRET`; redeploy.
3. In Stripe **live** mode: Settings > Billing > **Customer portal**, save the settings (allow cancel, switch plan,
   update card). Without it "Manage billing" errors.
4. Subscribe a real test organization with a real card, check the plan shows, cancel it, refund it.
5. Only then set `BILLING_ENFORCED=true`.

## Not built yet
Per-plan limits (apps, storage, notification counts), annual-vs-monthly proration messaging, invoices page (Stripe's
portal has them), emails about the trial ending (the dashboard banner only), a public pricing page.
