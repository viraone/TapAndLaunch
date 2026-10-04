# Legal pages and support

_Last checked: 2026-10-03._

## Pages

| Page | Address | Covers |
|---|---|---|
| Terms of Service | `/terms` | What TapAndLaunch is, accounts, content, acceptable use, payments (the builder is the seller; Stripe processes; we hold no funds), fees, Washington law |
| Privacy Policy | `/privacy` | What is collected from builders and from app users, who it is shared with (our providers), cookies, retention, choices |
| Refund Policy | `/refunds` | Shoppers ask the business that sold to them; builders refund from their own Stripe dashboard |
| Support | `/support` | How to reach us at `support@tapandlaunch.com` |

- Code: `src/app/(legal)/` with a shared layout; shared facts (brand, legal name, support email, "last updated" date) are in
  `src/lib/legal.ts`, so a change is made once.
- Linked from the landing page footer and from the signup form ("By creating an account you agree to...").
- The operator named on the pages is "Viradeth and Friends, doing business as TapAndLaunch", Seattle, Washington.
- **These are plain-language drafts, not legal advice.** Have a lawyer review the Terms (especially liability and governing
  law) before relying on them. When the product changes what it collects or charges, update Privacy and Terms and the date in
  `src/lib/legal.ts`.

## What Stripe expects

Stripe reviews the business website before approving payments. It looks for: what is being sold, terms of service, a privacy
policy, a refund policy, and a way to contact support. Those URLs are entered in Stripe under Settings > Business > Business
details > Public details. The statement descriptor (what appears on card statements) is `TAPANDLAUNCH`.

## Support inbox

`support@tapandlaunch.com` forwards to the owner's inbox through ImprovMX (see [email.md](email.md)).
