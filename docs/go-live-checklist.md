# Go-live checklist

_Last updated: 2026-10-03._ Tick items as they are done and note the date.

## Real money (Stripe)

- [ ] Finish activating the live Stripe account: tax id, bank account, any identity checks (Stripe dashboard > Setup guide >
      Verify your account)
- [x] Public details: support email, support/privacy/terms URLs, statement descriptor (2026-10-03)
- [ ] Phone verification on the Stripe account (Settings > Business > Account details)
- [ ] Connect in live mode: platform profile and branding
- [ ] Live webhook endpoint created; live `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel; redeploy
- [ ] One small real purchase and refund
- [ ] Delete test organizations and test apps from production

## Product basics before inviting real builders

- [ ] Forgot-password flow for builders (there is none yet)
- [ ] Shorter checkout: skip our name/email form when Stripe is connected (Stripe already asks)
- [ ] App-level email: set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` if the Email notification channel is wanted
- [ ] Show notification send times in the viewer's time zone (they show UTC)
- [ ] Lawyer review of Terms and Privacy

## StageTime launch (Fri Oct 23, 2026)

- [ ] Deploy the `lineup-feed` change that marks the signed-in comic's own row
- [ ] Set `lineup_url` on the live sign-up block
- [ ] Un-hide the tab and rename it "Sign-Up & Lineup"
- [ ] Review the request list's access rules (details in `docs/private/security-notes.md`)
- [ ] Point stagetimepnw.com's sign-up link and the Instagram bio link at the new page
- [ ] Remove "standby" wording from the old form
- [ ] Final test round Thu Oct 22 (test plan "Pass 1.0", plus the desktop pass)
