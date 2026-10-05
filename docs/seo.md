# SEO for the main site

_Last checked: 2026-10-05._ Only the main site (tapandlaunch.com) is covered here. Customers' published apps set their own title
and manifest and are not listed in the sitemap.

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
