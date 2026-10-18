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
3. Until then the builder shows **Waiting for DNS** and the record to add: a **CNAME** for a subdomain, an **A** record for a
   root domain (`routingRecord`, using Vercel's recommended values; today the A value is 216.198.79.1). If Vercel also
   wants a TXT ownership record it is shown too.
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

## Notes
- Removing a domain removes it from Vercel and the app row. A 404 from Vercel on removal counts as success.
- Hobby is Vercel's non-commercial plan. Once TapAndLaunch charges customers, Vercel's terms call for the Pro plan.
- Every customer domain is added to the same Vercel project, so Vercel's domain limits per project apply.
