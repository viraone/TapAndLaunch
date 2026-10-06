# Go-live checklist

_Last updated: 2026-10-06._ Tick items as they are done and note the date.

## Real money (Stripe)

- [x] Finish activating the live Stripe account (2026-10-05; unregistered business, no EIN: the IRS online form refused it, see
      `private/business.md`)
- [x] Public details: support email, support/privacy/terms URLs, statement descriptor (2026-10-03)
- [ ] Phone verification on the Stripe account (Settings > Business > Account details)
- [ ] Connect in live mode: platform profile and branding
- [x] Live webhook endpoints created (subscriptions + store payments); live `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and
      `STRIPE_BILLING_WEBHOOK_SECRET` in Vercel; redeployed (2026-10-05)
- [ ] One small real store purchase and refund (needs a store connected in live mode first; none yet)
- [ ] Delete test organizations and test apps from production (firstrun3 after its plan ends Nov 4; shop1 after the live store
      test; the two leftover test apps were unpublished 2026-10-05)

## Platform account
- [x] Vercel Pro (2026-10-05; Hobby is non-commercial)
- [x] `BILLING_ENFORCED=true` on production (2026-10-05)
- [ ] Remove the 4 leftover `tl-…test…` entries from the Vercel team's Domains list (needs the dashboard; the API token can't)
- [ ] EIN by phone (1-800-829-4933, reference 101) when convenient; optional Stripe Tax after an accountant's advice

## Product basics before inviting real builders

- [x] Forgot-password flow for builders, including the branded any-device reset email on production (2026-10-04)
- [x] Shorter checkout: skip our name/email form when Stripe is connected (2026-10-05)
- [x] Plans and billing (done 2026-10-05): see the checklist in `billing.md` (live webhook, customer portal, real test, then `BILLING_ENFORCED`)
- [x] App-level email: `RESEND_API_KEY` and `RESEND_FROM_EMAIL` set in Vercel (2026-10-05), live test passed
- [x] Show notification send times in the viewer's time zone (2026-10-05)
- [ ] Lawyer review of Terms and Privacy

## StageTime launch (Fri Oct 23, 2026)

- [ ] Deploy the `lineup-feed` change that marks the signed-in comic's own row
- [ ] Set `lineup_url` on the live sign-up block
- [ ] Un-hide the tab and rename it "Sign-Up & Lineup"
- [x] Review the request list's access rules (2026-10-03; see `docs/private/security-notes.md`)
- [ ] Point stagetimepnw.com's sign-up link and the Instagram bio link at the new page
- [ ] Remove "standby" wording from the old form
- [ ] Final test round Thu Oct 22 (test plan "Pass 1.0", plus the desktop pass)
