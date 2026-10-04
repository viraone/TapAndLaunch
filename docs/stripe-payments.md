# Card payments (Stripe Connect)

_Last checked: 2026-10-03._ Shipped to production 2026-10-03 (migration 0018). **Production currently uses the Stripe
sandbox key**, so no real money moves. See "Going live" below.

## What it does

A builder whose app has a product list can take card payments. Each builder's **organization connects its own Stripe
account**; shoppers pay on Stripe's hosted checkout page and the money goes straight to that account. TapAndLaunch never sees
card details and does not hold funds.

Without a connected account, the "Order" button keeps the old behaviour: a **purchase request** the builder follows up on by
hand.

## Design choices

| Choice | Why |
|---|---|
| **Stripe Connect, Accounts v2** (`stripe.v2.core.accounts`) | Stripe no longer accepts v1 account creation for new Connect integrations |
| `dashboard: "full"`, Stripe collects fees, Stripe covers negative balances | The "Standard" arrangement: each builder owns their Stripe account, payouts, refunds and disputes; the platform carries no payment risk |
| **Direct charges** on the connected account | The builder is the seller of record |
| **Stripe-hosted Checkout** | No card data touches our servers |
| Optional platform fee (`STRIPE_APPLICATION_FEE_PERCENT`) | Off today; a setting, not code, to turn on later |
| Minimum $0.50 per card order | Stripe's minimum; smaller orders stay requests |

## The flow

1. **Connect.** Dashboard > Settings > **Payments** card (organization admins only, and only when `STRIPE_SECRET_KEY` is set).
   The builder picks their country and clicks **Connect Stripe**. `POST /api/stripe/connect` creates the v2 account the first
   time and returns a one-time onboarding link. Stripe's pages collect identity, business and bank details.
2. **Back from Stripe.** Settings syncs the account from Stripe (`syncStripeAccount`) whenever setup is unfinished. The card
   shows one of: *Take card payments* (not started), *Finish setting up Stripe* (they still owe details), *Stripe is
   checking your details* (only Stripe's review remains), *Payments are on*.
3. **Buy.** In a published app, `POST /orders` saves the order (`pending`) and, if the organization's account can take
   charges, creates a Checkout session on that account and returns its URL. The shopper pays on Stripe.
4. **Confirm.** Two independent ways, whichever is first (both only act on a `pending` order with the matching session id):
   - **Webhook** `POST /api/stripe/webhook` with a verified signature marks it `paid`.
   - **Return visit**: the shopper lands on `?payment=success&order=...`; the page calls `POST /orders/confirm`, which asks
     Stripe whether the session is paid. The answer comes from Stripe, never from the caller.
5. **After.** Full refunds (done in the builder's Stripe dashboard) mark the order `refunded`. Expired or failed checkouts
   mark it `cancelled`. Stripe emails the receipt (live mode only).

## Rules enforced on the server

- A paid or refunded order can only be moved to **fulfilled** by hand; refunds and cancellations of paid orders happen in Stripe.
- An unpaid card order cannot be marked fulfilled.
- Webhook events are verified with `STRIPE_WEBHOOK_SECRET`; a bad or missing signature gets 400. Replaying an event changes
  nothing. An event for a different checkout session cannot mark an order paid.

## Data

- `stripe_accounts`: one row per organization (`stripe_account_id`, `charges_enabled`, `details_submitted`). Readable by the
  organization, written only by the server.
- `orders`: `payment_method` (`request` or `stripe`), `stripe_checkout_session_id`, `stripe_payment_intent_id`, `paid_at`;
  statuses `pending`, `paid`, `fulfilled`, `cancelled`, `refunded`.

## Code

| Path | Role |
|---|---|
| `src/lib/stripe/server.ts` | Stripe client; `isStripeConfigured`, `isStripeTestMode` |
| `src/lib/stripe/checkout.ts` | Checkout session parameters, fee, minimum amount, safe return paths |
| `src/lib/stripe/events.ts` | Turns a webhook event into an action (pure, tested) |
| `src/lib/stripe/readiness.ts` | Reads a v2 account: can it take charges, does the builder still owe details |
| `src/lib/stripe/accounts.ts`, `orders.ts` | Account sync; marking an order paid (shared by webhook and confirm) |
| `src/app/api/stripe/connect/route.ts`, `webhook/route.ts` | Connect and webhook endpoints |
| `src/app/published-apps/[appSlug]/orders/route.ts`, `orders/confirm/route.ts` | Placing and confirming orders |
| `src/components/pwa-runtime/ProductBuyRuntime.tsx` | The product card and Order button |
| `src/app/(dashboard)/dashboard/settings/PaymentsCard.tsx` | The Payments card |

## Webhook endpoint

One endpoint per Stripe mode, created in the Stripe dashboard (Developers > Webhooks) or by API:

- URL `https://tapandlaunch.com/api/stripe/webhook`, **listening to events on Connected accounts**.
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
  `checkout.session.expired`, `charge.refunded`, `account.updated`.
- Its signing secret goes in Vercel as `STRIPE_WEBHOOK_SECRET`. The sandbox endpoint exists today; a **live** endpoint (with
  its own secret) is needed when switching to live keys.
- Check deliveries in the Stripe dashboard under the endpoint, or with `stripe.events.list({ delivery_success: false })`.

## Testing in the sandbox

Card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP. Untick "Save my information" on the checkout page (its phone
check rejects fake numbers). For onboarding a test connected account and Stripe's test identity values, see
[runbooks.md](runbooks.md#test-a-card-payment-in-the-sandbox).

Automated tests: `src/lib/stripe/*.test.ts` (checkout parameters, event mapping, readiness).

## Going live

1. Finish activating the **live** Stripe account (business details, representative, tax id, bank account). The Setup guide
   in the Stripe dashboard lists what is left. Stripe reviews the website, terms, privacy and refund pages.
2. Make sure Connect is set up in **live** mode (platform profile, branding).
3. Create the **live** webhook endpoint (same URL and events) and copy its signing secret.
4. In Vercel, replace `STRIPE_SECRET_KEY` with the live secret key and `STRIPE_WEBHOOK_SECRET` with the live signing
   secret. Redeploy.
5. Builders must connect again in live mode: sandbox connected accounts do not carry over. Delete test organizations first.
6. Make one small real purchase and refund it.
