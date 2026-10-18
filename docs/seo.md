# SEO for the main site

_Last checked: 2026-10-05._ The first part is the main site (tapandlaunch.com); customers' published apps are the last section.

- **Home page** (`src/app/page.tsx`): title, description, canonical address, Open Graph and Twitter tags, and JSON-LD
  (`Organization`, `SoftwareApplication` with the plan prices from `src/lib/billing/plans.ts`, `FAQPage`). The wording that
  search engines read lives in `src/lib/marketing.ts` so the page, the share card and the structured data agree.
- **`/robots.txt`** (`src/app/robots.ts`): allows everything except the dashboard, API and account pages, and points to the sitemap.
- **`/sitemap.xml`** (`src/app/sitemap.ts`): the home page, sign-up, support and the legal pages.
- **Share picture** (`src/app/og/route.tsx`, 1200x630): used by the home page only. It is deliberately **not** an
  `opengraph-image` at the app root, because customers' apps inherit the root layout and would show our picture when shared.
- **No title template** in the root layout, for the same reason (it would rewrite every customer app's title).
- `metadataBase` is set from `NEXT_PUBLIC_ROOT_DOMAIN`, so canonical and share addresses are right in every environment.

When the pricing or plan changes, the home page, the FAQ and the structured data update by themselves (they read `PLAN`).
After a big change, test the share card at the platforms' own debuggers and run the audit tool (`seo-audit`, its own project).

## Trade pages (`/for`, `/for/<trade>`)

_Added 2026-10-16._ One public page per website topic in `src/lib/apps/templates.ts` (photographers, consultants, tutors,
builders and so on): what someone searching "website for a photographer" lands on, since nobody searches for the product's
name. The data is `src/lib/marketing/trades.ts`: everything on a page comes from the trade's own starter (its tagline, the
real laptop-and-phone preview drawn by `SiteFrame`, and "What it includes" worked out from the sections the starter really
has), so a page can never promise something the template does not do, and a new topic gets its page without anyone writing
one. The only hand-written part is who each page speaks to (`PEOPLE`). Titles stay under 60 characters and descriptions
under 160 (tests). Every page is in the sitemap, linked from the header ("Trades") and the home page, and its button opens
the picker with that topic already chosen (`/dashboard/apps/new?template=<id>`) for a signed-in person, or sign-up otherwise.
Search engines take weeks to months to rank new pages; the weekly SEO check covers them.

## Customers' published apps

_Added 2026-10-17, after a published app scored 66 (D) on the audit tool against the main site's 98._ Every page of a block
app now sends what the audit looks for, worked out from what the owner already wrote (`src/lib/pwa/seo.ts`, tested), so a
site built in the builder scores an A without the owner knowing what a canonical is. The owner's own fields on a page
(SEO title, description, share picture, in the builder's page settings) still win over all of it.

- **One address per page.** `canonicalOrigin`: the connected custom domain when there is one, else the address the page
  was opened at. The home page is `/`; its path (`/home`) is a permanent redirect there, and the site header and tab bar
  link it as `/`. The sitemap and robots.txt use the same origin, so a site on a custom domain lists its own addresses.
- **Title.** The page's SEO title; else the home page is the app's name with its tagline when the name alone is short
  (`pageTitle`), other pages "Page · App".
- **Description, never the same twice.** The page's own; else the app's (home page only); else the first words on the
  page (banner subtext, text body, quote…); else the page's name with the app's description.
- **Share tags**, always: Open Graph (type, url, site name, title, description, picture) and a Twitter card. A page with
  no share picture gets one drawn at `/share-image[?page=<path>]` (`share-image/route.tsx`: the letter tile or icon, the
  name, and the tagline or page title on the tile gradient, 1200x630).
- **One h1.** The first section with a heading carries it (`firstHeadedBlockIndex`); inside that section h2 becomes h1
  and h3 becomes h2 (`PromoteHeading` in `Editable.tsx`, passed as `headingLevel` by the page). A page with no heading at
  all gets a hidden one with its title. The contact form's title is an h2 (was h3).
- **JSON-LD** on every page: `WebSite`, `Organization` (with the icon as logo), `WebPage`, and `FAQPage` when the page has
  a Questions section.

Checked with the audit tool on the SEO Site Tuneup site (five pages, `docs/private/seed-seositetuneup.mjs`): 100/100.
The address a site is reached at is not redirected: a published app answers on `{slug}.tapandlaunch.com` and its custom
domain alike, and the canonical tag tells search engines which one counts.
