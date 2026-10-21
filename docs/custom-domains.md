# Custom domains

_Last checked: 2026-10-05, tested against the real Vercel project._ A customer can attach their own domain
(`app.theirbrand.com`) to an app, in the builder's app settings. The app stays reachable at `{slug}.tapandlaunch.com` too.

## Setup (done once)
Three Vercel environment variables (Production): `VERCEL_API_TOKEN` (**secret**, scoped to the team that owns the project,
expires 2027-10-05, name `tapandlaunch-domains`), `VERCEL_PROJECT_ID` (`tap-and-launch`) and `VERCEL_TEAM_ID`. IDs are in
`docs/private/accounts-and-ids.md` (git-ignored). Renew the token before it expires: Vercel > Account > Tokens.

The token can do anything in that team, including reading environment variables; it cannot be limited to domains. Keep it
only in Vercel's settings.

## How it works
1. `POST /api/apps/{id}/domain` validates the name (`validateCustomDomain`: no `tapandlaunch.com` or its subdomains), adds it
   to the Vercel project, then asks Vercel for its DNS config.
2. The app is **Connected** only when Vercel owns the domain *and* its DNS points at Vercel. Vercel's own `verified: true`
   only means the project owns the domain (a domain pointing nowhere is still "verified"), so we also check
   `GET /v6/domains/{domain}/config` (`misconfigured`).
3. Until then the builder shows **Waiting for DNS** and the records to add: a **CNAME** for a subdomain, an **A** record for a
   root domain (`routingRecord`, using Vercel's recommended values; today the A value is 216.198.79.1), plus the `www`
   CNAME for a root domain (see "www and non-www" below). If Vercel also wants a TXT ownership record it is shown too.
4. "Check again" (`POST .../domain/verify`) re-checks. SSL is automatic once DNS works.
5. Traffic arriving on a connected, published app's domain is routed by `proxy.ts` (`resolveAppSlugForHost`).

## Domains in the platform's NameSilo account (2026-10-17)
TapAndLaunch buys domains for customers at NameSilo (one account, `NAMESILO_API_KEY`). When a domain that lives there is
typed into the Domain tab, step 3 above happens by itself: `pointDomainAtUs` (`lib/domains/namesilo.ts`) checks the
domain is in the account and still on NameSilo's nameservers (`*.dnsowl.com`), reads its DNS records, replaces the
parking A/CNAME records on that host with the one Vercel wants, adds any TXT record, then asks Vercel to check once
more. `apps.custom_domain_dns = 'namesilo'` marks it; the builder then says "set for you" instead of showing records.
A domain bought anywhere else is untouched (`not_here`); a NameSilo domain moved to other nameservers is left alone
too (`other_dns`) and falls back to the by-hand records. Removing the domain from the app does not touch the records
at NameSilo. NameSilo answers `code` 300 on success and lists come back as one object when there is one item.

## www and non-www (2026-10-18)
A root domain and its `www.` spelling are handled as a pair, so a site never answers on one and not the other (the SEO
audit's "www and non-www agree" check; seositetuneup.com failed it before this and was fixed by hand). `companionDomain`
(`lib/domains/dns.ts`) names the twin: `www.brand.com` for `brand.com`, `brand.com` for `www.brand.com`, none for any other
subdomain. When a domain is connected, `addDomain` also adds the twin to the Vercel project as a **308 redirect** to the
connected domain (`ensureRedirect`: `POST /v10/projects/{id}/domains` with `{name, redirect, redirectStatusCode: 308}`; a
twin already on the project gets its redirect set with a `PATCH` instead). The redirect happens at Vercel's edge, before
`proxy.ts`, which only redirects the platform's own `www.tapandlaunch.com`.

- The Domain tab lists the twin's record next to the main one: `CNAME www → cname.vercel-dns.com` beside a root domain's
  A record, or the root's A record beside a connected `www`. The twin never blocks **Connected**: once the main domain
  routes the app is verified, and a still-missing twin record stays on the list with "Check again" until it points here.
- A domain in the platform's NameSilo account gets the twin's record written by `pointDomainAtUs` too (it is just one more
  wanted record; the parking `www` CNAME is replaced).
- Removing a domain removes the twin from Vercel as well. The twin is left alone, on add and on remove, when another app
  uses it as its own custom domain (`companionOptions`, `lib/domains/companion.ts`).
- A twin that cannot be added does not fail the connection; the builder shows a warning (`companionError`).
- Domains connected before this date: `docs/private/add-www-redirects.mjs` (git-ignored) lists them and adds the missing
  redirects; dry run by default, `--apply` to do it.

## Notes
- Removing a domain removes it from Vercel and the app row. A 404 from Vercel on removal counts as success.
- Hobby is Vercel's non-commercial plan. Once TapAndLaunch charges customers, Vercel's terms call for the Pro plan.
- Every customer domain is added to the same Vercel project, so Vercel's domain limits per project apply.

## Buying a domain in the Domain tab (2026-10-20)
A customer can buy a domain without leaving the builder: App settings > Domain > **Get your own address**. Code in
`lib/domains/buy.ts` (pure helpers), `purchase.ts` (server), `attach.ts` (the connect step, shared with "Add domain"),
the routes under `api/apps/[appId]/domain/{search,buy,orders}`, and the `domain_orders` table (migration 0045).

1. **Search**: words or a name (`costume contests seattle`, `brand.org`) become one label priced with each ending we
   sell (`.com`, `.net`, `.org`; `BUYABLE_TLDS`), the typed ending first. `checkRegisterAvailability` gives the first-year
   and renewal prices; premium names are shown as taken. The customer pays **the registrar's price, nothing on top**
   (as of 2026-10-20: .com $17.29, .net $15.95, .org $10.79 then $14.99); Stripe's fee (~3% + 30¢) is ours to absorb.
2. **Buy and connect** (org admins only): `POST .../domain/buy` prices the domain again, inserts a `pending` order and
   opens Stripe Checkout in payment mode on **our own** Stripe account (same customer as the plan, `customerFor`), with
   `domain_order_id` in the session metadata. Success and cancel both return to the builder with `?domain=…&order=…`.
3. **Fulfilment** (`fulfillDomainOrder`) runs from two places, the builder page the customer returns to (so the result
   shows at once) and the billing webhook's `checkout.session.completed` (the backstop); `checkout.session.expired`
   cancels a pending order. It is safe to run twice: it checks the session is `paid` with Stripe, then flips the row
   `pending → paid` with a conditional update, and only the caller whose update matched goes on to `registerDomain`
   (1 year, WHOIS privacy and auto-renew on, the account's default contact, paid from the NameSilo balance). Success
   marks the row `registered` with `expires_at`, then `attachDomain` connects it exactly like a typed domain (Vercel +
   www twin + NameSilo DNS). A refused registration marks the row `failed` with the reason: **refund by hand** in Stripe
   and the Refund Policy page promises that. A registered domain that could not be connected keeps a note in `error`
   and the tab offers "Connect it to this site".
4. The builder opens the Domain tab on return (`domainReturn` → the `open-app-settings` event) with a toast for each
   outcome, and drops the query string so a reload does not repeat it.

Renewals are by hand for now: NameSilo auto-renews from the account balance; `domain_orders.expires_at` says when each
customer's year ends, and the customer is asked to pay again before then. Not built: renewal reminders, transfers out,
a refund from the app, other endings.

Trying it locally: Stripe's test key is in `.env.local`; set `NAMESILO_FAKE_REGISTER=1` so the test card (4242…) does not
register a real domain. The "connect" step still talks to the real Vercel project (as "Add domain" does locally), so
remove the test domain from the app afterwards. Stripe's webhook does not reach localhost; the return page does the work.

Making a customer's account free (Alfredo, the first one): once they have signed up, with the service role,
`update org_billing set status = 'complimentary' where organization_id = (select organization_id from memberships m join auth.users u on u.id = m.user_id where u.email = '…')`.

## tapandlaunch.com/domains and Dashboard > Domains (2026-10-20, later the same day)
Domains are something a customer owns on TapAndLaunch, not only a setting of one site. `domain_orders.app_id` is
nullable (migration 0047): a domain bought on its own has no site until it is connected.

- **/domains** (public, `src/app/domains`): a registrar-style search page. `GET /api/domains/search?q=` needs no
  account and is limited to 20 searches a minute per address (`lib/domains/search-limit.ts`, in memory). "Buy" sends a
  visitor to `/signup?next=/domains?q=…` (sign-up → onboarding → back here; `lib/auth/next-path.ts` `withNext`, and
  login/signup/onboarding honour `?next=` for same-site paths) and a signed-in **organization admin** to Stripe
  (`POST /api/domains/buy`, `startDomainCheckout` with `appId: null`), which returns to `/dashboard/domains`.
- **Dashboard > Domains** (`src/app/(dashboard)/dashboard/domains`): every order of the organization (not cancelled),
  which site each registered domain is connected to, and a site picker + Connect for the ones that aren't
  (`POST /api/domains/{orderId}/connect` → `connectDomainOrder`: records `app_id` on the order, then `attachDomain`).
  Finishes a purchase on `?domain=success&order=…` exactly like the builder page does.
- The builder's Domain tab lists the organization's unattached purchases too (`GET /api/apps/{id}/domain/orders`
  returns orders for this app or with no app) and its "Connect it to this site" goes through the same connect route.
- Nav: "Domains" in the marketing header and the dashboard header; `/domains` is in the sitemap.

### Domain first, site later (2026-10-20, later still)
A registered domain whose organization has no site shows "Build the site for brand.com" on Dashboard > Domains, which opens
the picker with `?domain=<orderId>`. The picker says so in its header and on the name step, sends `domain_order_id` with
`POST /api/apps`, and the route connects the domain (`connectDomainOrder`) right after `createAppFromStarter`; the
answer carries `domain` (connected) or `domainError` (the site exists, connect by hand from the Domain tab). The
builder opens with the domain attached and "Waiting for DNS" until Vercel sees it.

**Removal order:** `removeDomain` deletes the www/root twin (a redirect) *before* the domain. Vercel refuses the other
order with "Cannot remove X until existing redirects to X are removed"; before this fix every root domain connected
since the www pair shipped could not be removed from the Domain tab.
