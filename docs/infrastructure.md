# Infrastructure

_Last checked: 2026-10-03._ TapAndLaunch is a Next.js app (App Router, React 19) that builds and serves small installable
web apps (PWAs) for many customers ("tenants") from one codebase.

## How it fits together

```
 Customer's phone/browser
        |
        |  https://{app}.tapandlaunch.com   (wildcard)         https://tapandlaunch.com (marketing, login, dashboard)
        v
 [ Vercel ]  one Next.js project; src/proxy.ts maps the host name to the right app
        |
        +--> [ Supabase: TapAndLaunch project ]  Postgres + Auth + Storage (accounts, apps, pages, blocks, members, orders)
        +--> [ Stripe ]        card payments for stores (Connect) <--- webhook ---> /api/stripe/webhook
        +--> [ Web push ]      browser push services (Chrome, Firefox), signed with our VAPID keys
        +--> [ Google Maps ]   Places data for the Gas and Food blocks (cost-gated per organization)
        +--> [ Resend ]        outgoing email (sign-in emails via Supabase SMTP)
        +--> [ Twilio ]        text messages (optional, not switched on)

 Email sent TO @tapandlaunch.com --> [ ImprovMX ] --> the owner's inbox        (support@tapandlaunch.com)

 StageTime sign-up (a block inside one tenant app) --> [ Supabase: rickshaw-open-mic project ] + Google Sheet
```

## Services

| Service | What it does for us | Where it is set up |
|---|---|---|
| **GitHub** `viraone/TapAndLaunch` | Source code. Pushing `master` deploys. **The repository is public.** | github.com |
| **Vercel** project `tap-and-launch` (team "viradeths-projects", Hobby plan) | Hosts the app; builds on every push to `master`; owns the DNS for tapandlaunch.com | vercel.com |
| **Domain** `tapandlaunch.com` | Registered at Porkbun. Its name servers point at Vercel, so **DNS records are edited in Vercel** (Domains > tapandlaunch.com > DNS Records), not at Porkbun | Vercel + Porkbun |
| **Supabase** project "TapAndLaunch" (Pro plan) | Main database, sign-in, file storage. Region/plan are in the Supabase dashboard | supabase.com |
| **Supabase** project "rickshaw-open-mic" (Free plan) | StageTime's request list, its own sign-in, edge functions and scheduled jobs. See [stagetime-signup.md](stagetime-signup.md) | supabase.com |
| **Stripe** | Card payments for customers' stores. Currently the **sandbox (test) key is on production**. See [stripe-payments.md](stripe-payments.md) | stripe.com |
| **Resend** | Sends email. Supabase Auth uses it as its SMTP server. The Resend account is shared with another of the owner's projects | resend.com |
| **ImprovMX** (free) | Forwards mail sent to `*@tapandlaunch.com` (including support@) to the owner's inbox | improvmx.com |
| **Google Maps Platform** | Places and map data for the Gas prices and Live food blocks. **It costs money per use**, so those blocks are off until a platform admin switches them on for an organization | console.cloud.google.com |
| **Twilio** | Optional text messages from the notifications page. Not configured on production | twilio.com |
| **Docker + Supabase CLI** (developer machine) | A local copy of the database for development and tests | local |

## URLs

| Address | What it is |
|---|---|
| `https://tapandlaunch.com` | Marketing page, `/login`, `/signup`, `/dashboard`, `/onboarding` |
| `https://tapandlaunch.com/terms`, `/privacy`, `/refunds`, `/support` | Legal and support pages |
| `https://{slug}.tapandlaunch.com` | A published customer app. `src/proxy.ts` and `src/lib/tenant.ts` turn the host name into the app |
| `https://stagetimepnw.tapandlaunch.com/signup` | The StageTime PNW open-mic sign-up |
| `http://localhost:3100` (and `{slug}.localhost:3100`) | Local development. Port 3000 is used by another project on the same machine |
| `http://{Mac IP}:3101` | The phone preview (`npm run dev:phone`), see [runbooks.md](runbooks.md) |

## Two kinds of users

- **Builders** (our customers) have a Supabase Auth account, belong to an **organization**, and manage apps in the dashboard.
- **App members** are the builders' own end users. They sign up inside a published app. They are separate from Auth users (own
  table, own password hashing, own session cookie) so one person can be a member of many apps.
  The StageTime sign-up is different again: its comics sign in with an emailed code in the *rickshaw-open-mic* Supabase project.

## Where the code lives

| Path | Contents |
|---|---|
| `src/app/(dashboard)/` | Dashboard: apps, builder, orders, products, notifications, settings, admin |
| `src/app/(auth)/`, `src/app/auth/` | Login, signup, email confirmation callback |
| `src/app/(legal)/` | Terms, Privacy, Refunds, Support |
| `src/app/published-apps/[appSlug]/` | Everything a published app serves (pages, orders, push, members, service worker) |
| `src/app/api/` | Dashboard APIs, Stripe Connect and webhook |
| `src/components/pwa-runtime/` | The blocks a published app renders, including the StageTime sign-up |
| `src/lib/stripe/`, `src/lib/notifications/`, `src/lib/pwa/`, `src/lib/openmic/` | Server and shared logic, each with tests |
| `supabase/migrations/` | The database schema, in order |
