# First run and "Describe your app"

_Last checked: 2026-10-05._ What a brand-new customer sees, and how the app-from-a-sentence feature works.

## The first run
1. Sign up, then "Create your organization" (`/onboarding`).
2. The dashboard sees an organization that has **never had an app** and sends an admin or creator straight to
   `/dashboard/apps/new?welcome=1`: "Welcome to TapAndLaunch. What are you building?" with a four-step guide (Choose a start,
   Name it, Make it yours, Publish and share). An organization whose apps were all deleted still gets the dashboard, so it can
   restore them.
3. The page offers **Describe your app** at the top, then 11 templates in 6 groups (`TEMPLATE_CATEGORIES` in
   `src/lib/apps/templates.ts`). Each card has a small phone drawn from the starter's own blocks (`TemplatePreview`), so the
   picture always matches what the customer gets. Templates that need live maps data (Food finder, Gas prices) are hidden from
   accounts without maps switched on (Admin page), so a new customer sees 9 usable templates; an empty group is hidden.
4. Creating an app lands in the builder, where the **Get live** checklist is: Create, Add your content, **Pick your colors and
   icon** (ticks when an icon is uploaded or colors are saved in App settings: `theme.looks_confirmed`), Publish, **Scan the QR
   code** (opens the app's page, which has the QR code; ticks when someone opens the app).

## Showcase templates
All eight business templates (Gym, Restaurant, Salon, Club or community, Online store, Local business, Events & bookings,
Open mic list) open as finished-looking apps: a photo banner with a button, a strip of highlights,
a menu or membership price list, a photo gallery, reviews and opening hours, in a style of their own (the gym is dark with a
red accent, the restaurant warm cream with burnt orange), with a tab bar. The salon is soft blush with deep rose, the community light mint with teal, the store warm cream with
amber. The gym, salon and community create sample classes, appointments or events for the coming days, and the store creates
three sample products (`StarterProduct`), all marked as samples. Sample events are created for the next
week (`StarterEvent`, `sampleEventRows`, placed in Pacific time), each marked as a sample. The six showcase blocks are in
`src/components/pwa-runtime/ShowcaseBlocks.tsx` (editors in `builder/blocks/ShowcaseEditors.tsx`), photos in
`template-photos.md`. Events & bookings creates four sample events and Open mic list five sample mics (`StarterListing`). Event and dashboard dates use `src/lib/format-date.ts`, which gives identical text on the server and in every browser (`toLocaleString` with `dateStyle` differs between Node and Safari and caused hydration errors).

## Describe your app
`POST /api/apps/generate` takes a sentence (10 to 500 characters) and an optional name, designs a first version and creates it
exactly like the template picker does (`createAppFromStarter`, shared with `POST /api/apps`).

- **With `ANTHROPIC_API_KEY` set** (Vercel, Sensitive): Claude (`AI_MODEL`, default `claude-sonnet-5-5`) designs 1 to 4 pages.
  The system prompt is in `src/lib/ai/app-spec.ts`; the customer's words are passed inside `<description>` tags as data.
- **Without a key, or if the model's answer is unusable or the call fails:** the sentence is matched to the closest template
  by keywords (`matchTemplate`) and a name is taken from "called X" if present, otherwise "My <template>". The customer always
  gets an app.
- **Safety:** the model's JSON must pass `GeneratedAppSchema`: only text, contact form, event calendar, product list and image
  blocks, bounded lengths, safe page paths and field names, a hex color. No links, embeds, video or maps blocks, so a clever
  description can't add anything risky. Nothing from the model is executed.
- **Cost control:** `ai_generations` (migration 0028) counts designs per person; `AI_DAILY_LIMIT` (10 per 24 hours, in
  `src/lib/ai/limits.ts`). Only editors of the organization can call it, checked before any model call. Picking a template is
  never limited. Expect a design to cost roughly a cent or two.

## Testing without a key
Everything works locally with no key (the matched fallback). The Claude path is covered by unit tests with a mocked response
(`src/lib/ai/app-spec.test.ts`); to try it for real, set `ANTHROPIC_API_KEY` in `.env.local`.

## Hidden for accounts without maps
Food finder and Gas prices (templates) and the Live food and Gas prices blocks (builder block list) only appear for accounts
with maps switched on. The server also refuses maps blocks for other accounts.

## Website layout
_Added 2026-10-14._ App settings > Theme > **Layout** offers **App** (the phone-shaped column on every screen, the default) and
**Website** (`theme.layout = "website"`): full width on a laptop with a menu of the pages at the top (`SiteHeader`, fed by the
same `bottom_nav` items as the tab bar), the phone look with the tab bar on a phone. The blocks are the same: they size
themselves to their column with Tailwind container queries (`@lg:` and up, against the `@container` content column), so an
app's 28rem column never triggers the wide styles. The builder's "Preview on" switch gains **Desktop**, a laptop-browser frame
drawn at 1180px and scaled to fit; in a website it shows the top menu and no tab bar. First used for a client's site at
davidbabucomedy.com.

## Quick updates
_Added 2026-10-14._ `/dashboard/apps/{id}/updates`: one page with the three things the owner of a live app does week to
week, for clients who run an app someone else built. **Add a show** (an event with date, venue, optional ticket link; the
existing events API), **Add photos** (uploads to `app-assets`, then `POST /api/apps/{id}/photos` appends them to the
app's first Photo gallery block, the home page's first, creating one if the app has none; a gallery holds 24 photos),
**Messages** (the last five form submissions). "Change the design" opens the builder. The app card's big button reads
"Quick updates" once the Get live checklist is complete; before that it still names the next step. The card's More menu
and the app overview link to it too.

Events can carry a **ticket link** (migration 0040): with one, the event's card shows a Tickets button that opens it in a
new tab instead of the booking form.

## Editing on the page
_Added 2026-10-14._ The builder works the way Squarespace does: the page is the editor. Every section's words
(headlines, paragraphs, highlights, menu items and prices, hours, reviews, titles, button labels, file names) are
edited in place: click, type, Enter or click away (`EditableText`, which renders plain text on the published site;
`BlockEditContext` in `SortableBlockItem` routes the change through the same path as the inspector's fields, via
`setAt`). Sections are added where they go: a **+ Add section** bar appears between sections (and sits at the end of
the page) and opens a visual menu (`AddSectionBar`); there is no list of sections down the side any more. The inspector
on the right is for photos, links and settings.
