# TapAndLaunch documentation

How TapAndLaunch is built, where it runs, and how to operate it. Written 2026-10-03, after the first production launch of
accounts, card payments, push notifications, email and the StageTime sign-up.

| Read this | When you need to know |
|---|---|
| [infrastructure.md](infrastructure.md) | Every service we use, what it does, and how they connect |
| [environment-variables.md](environment-variables.md) | Every setting the app reads, where it is set, and what happens without it |
| [database.md](database.md) | The Supabase projects, the migrations, access rules, and the auth settings |
| [deploying.md](deploying.md) | How code gets to production (`/push`), checks, rollbacks |
| [stripe-payments.md](stripe-payments.md) | Card payments for stores: design, data, webhooks, testing, going live |
| [custom-domains.md](custom-domains.md) | Customers' own domains: Vercel setup, how "Connected" is decided |
| [seo.md](seo.md) | Search and share setup for the main site: metadata, sitemap, robots, structured data |
| [billing.md](billing.md) | What customers pay TapAndLaunch: the plan, trial, Stripe Billing, enforcement switch |
| [email.md](email.md) | Sending email (Resend), receiving email (support@), and the DNS records behind both |
| [push-notifications.md](push-notifications.md) | Web push: keys, service worker, click handling, testing |
| [stagetime-signup.md](stagetime-signup.md) | The Read The Room sign-up at stagetimepnw.tapandlaunch.com |
| [legal-and-support.md](legal-and-support.md) | Terms, Privacy, Refunds and Support pages, and what Stripe expects |
| [go-live-checklist.md](go-live-checklist.md) | What is left before real money and the Oct 23 StageTime launch |
| [runbooks.md](runbooks.md) | Step-by-step how-tos: add a setting, add a DNS record, test a payment, reset test data |
| [known-issues.md](known-issues.md) | Things that surprise people, and their fixes |

## Rules for these docs

- **Never write a secret here.** This repository is public. Name a setting and say where it lives; never paste its value
  (API keys, signing secrets, passwords, tokens, account numbers). The same goes for personal details.
- Account IDs, security notes and business details live in `docs/private/`, which is git-ignored and only exists on the
  maintainer's computer.
- Each page says when it was last checked. If you change how something works, change its page in the same commit.
- Things that were set up by clicking in a website (Vercel, Stripe, Supabase, Resend, ImprovMX) are not visible in the code,
  so they are written down here. If you change one, update the page.
