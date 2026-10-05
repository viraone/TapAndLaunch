# Taking apps down, reports, and the separate domain for AI apps

_Added 2026-10-05._ Apps written by a customer's own AI (BYOB, `apps.kind = 'code'`) are code we didn't write, so they get
two protections before customers use BYOB widely.

## A separate domain for AI-written apps
Published AI apps are served from `{slug}.{NEXT_PUBLIC_CODE_APPS_DOMAIN}` (planned: `tapandlaunch.app`), not from
`tapandlaunch.com`. A malicious app then can't pass itself off as TapAndLaunch, and if browsers ever flag one as harmful
the main site isn't affected. (The app's code also runs sandboxed with no access to TapAndLaunch cookies; see
`docs/byob.md`.)

- `getCodeAppsDomain()` / `rootDomainFor(kind)` / `hostRoot(host)` in `src/lib/tenant.ts`. `extractAppSlug` accepts both
  domains. Unset = everything stays on the main domain, exactly as before.
- An AI app opened at its old `.tapandlaunch.com` address redirects to the new domain (page: `[[...path]]/page.tsx`;
  its code: `app-code/route.ts`, 308). Block apps are not served from the AI-apps domain (`layout.tsx`, 404).
- Links use the right domain: `appLiveUrl` (takes `kind`), the code builder, dashboard app cards, email/push links.
  Neither domain can be added by a customer as a custom domain (`validateCustomDomain`).

### Turning it on (once the domain is bought)
1. Buy the domain in Vercel (Domains > Buy) so it uses Vercel's nameservers; wildcard certificates need that.
2. Add `tapandlaunch.app` and `*.tapandlaunch.app` to the `tap-and-launch` project (Settings > Domains, or the API).
3. Set `NEXT_PUBLIC_CODE_APPS_DOMAIN=tapandlaunch.app` (Production) and redeploy (it's a `NEXT_PUBLIC_` value, read at build).
4. Check: an AI app at `{slug}.tapandlaunch.com` lands on `{slug}.tapandlaunch.app` and works; a block app at
   `{slug}.tapandlaunch.app` is "not found".

Locally: `NEXT_PUBLIC_CODE_APPS_DOMAIN=apps.localhost:3100` (Chrome resolves `*.localhost`).

## Reports
Every published AI app shows a small **Report** link (bottom-left), drawn by our page around the app's sandboxed frame,
so the app's own code can't hide it. It opens `/report` on the app's address: a reason, optional details and an optional
email. `report/send/route.ts` saves it to `app_reports` (no account needed; 5 per hour per person, counted by a salted
hash of the address, never the address itself) and emails every platform admin (`notifyAdmins`).

## Taking an app down
Platform admins see **AI apps and reports** on `/dashboard/admin#reports` (open reports first) with **Take down…**
(asks for a reason the owner sees), **Restore** and **Dismiss reports**
(`POST /api/admin/apps/{id}/moderation`).

A taken-down app (`apps.suspended_at`, `suspended_reason`, migration 0033):
- isn't served anywhere: `getPublishedApp` skips it, so every published route treats it as gone; the app's address says
  "This app is unavailable";
- shows its owner a banner with the reason in the builder, "Taken down" on the dashboard card, and can't be published;
- is guarded in the database (`guard_app_suspension`): only the server or a platform admin can set or clear the takedown,
  and an owner can't republish a taken-down app through any route.
