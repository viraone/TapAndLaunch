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
   code** (opens the app's page, which has the QR code; ticks when someone opens the app). Once every step is done the
   checklist disappears from the builder (the live address is in the top bar).

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

## Desktop View: a website-layout starter
_Added 2026-10-14._ The template picker's first group is **Desktop View** (`TEMPLATE_CATEGORIES` in
`src/lib/apps/templates.ts`, listed first so it's the first thing offered), for starters that open full width on a
laptop instead of the phone-shaped column (`theme.layout = "website"`, see "Website layout" above). Its one template
so far, **Personal website** (id `portfolio`), is a colour-led site for a person or consultant: a photo-less hero
(falls back to `bg-primary`, so there's no stock photo of a stranger), highlights, an about page, testimonials, a
Newsletter sign-up and a contact page. `TemplatePreview` draws it as a tiny browser window (traffic-light dots, a wide
frame) instead of a phone when the starter's `theme.layout` is `"website"`, so the card itself signals "this one's a
website" before anyone clicks it. Opening the builder on a `"website"` app also defaults the "Preview on" switch to
**Desktop** instead of iPhone (`BuilderClient`'s initial `device` state), so a Desktop View starter opens already
showing its real, full-width look.

The picker itself (`NewAppForm.tsx`) splits into two labelled shelves separated by a visible rule: **Websites**
(any category tagged `"website"`) above, **Apps** (every other category) below — so the one full-width starter
doesn't just blend into the phone-shaped grid with a small pill saying "Desktop View". Adding a second website
category later joins the Websites shelf automatically (`WEBSITE_CATEGORIES`/`APP_CATEGORIES` filter on
`category.id === "website"`, nothing hand-listed).

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
the page) and opens a visual menu (`AddSectionBar`); there is no list of sections down the side any more. Photos are replaced by
clicking them, on the page (`EditableImage`: the banner's background, an image section, each gallery photo) or on the
inspector's thumbnail; the file goes to `app-assets` and its address into the block. The inspector on the right is for
links and settings.

The page and the inspector are linked: clicking a piece of text on the page lights up its box in the inspector and
scrolls to it, and focusing a box lights up the words on the page (`src/lib/builder/field-link.ts`: both sides carry the
field's path as `data-field`; `linked(path)` on an inspector input, `EditableText` on the page). **Build with AI** is
switched off in the builder for now (`AI_CHAT_ENABLED` in the builder page); the BYOB app type still builds from its chat.

The inspector's list of sections shows a few words from each ("Banner · Come laugh with me"), and hovering a row
outlines that section on the page and scrolls to it (`data-block-id` on the section, `data-block-pointed` styled in
globals.css).

## Builder regression pass (2026-10-14)
Walked through as a non-technical owner, then fixed: removing a section offers **Undo** in a toast for eight seconds
(it autosaves, so there was no way back); **Unpublish** asks first and says what visitors will see; the top bar shows
the app's own domain once it is connected; the banner's button picks its page from a list instead of a typed address;
plain-words labels in App settings ("Design & settings", "Icon & name", "Font (optional)", "Tabs at the bottom", the
home-screen mode in sentences, a picture picker for tabs) and on sections ("Who can see this section"). Pages: the open page's tab
has a menu (Rename, Move left/right, Duplicate with its sections, Show/Hide in the menu, Delete with a confirmation; Home
can't be deleted) backed by `PATCH`/`DELETE /api/apps/{id}/pages/{pageId}`.

Undo and redo: every change to a page's sections (words, photos, add, remove, move, duplicate, who can see it) is a
step; ⌘Z / Ctrl+Z undoes, ⇧⌘Z or Ctrl+Y redoes, and the top bar has the two buttons (`editBlocks` in BuilderClient
keeps up to 60 steps per page; typing into one field in a row is one step; a page switch starts fresh). Every section
has Move up, Move down and Duplicate buttons next to the drag handle.

Formatting: paragraphs (a Text section's body, the banner's line, a menu item's description, a Zoom section's
description) carry bold, italic, links and bulleted lists. On the page a formatting bar appears while the paragraph is
being edited (the browser's own bold/italic/link/list commands); the result is stored as plain text with light
markers, `**bold**`, `_italic_`, `[words](https://…)`, lines starting with `- ` (`src/lib/rich-text.ts`: parse,
and the DOM-to-text reader for the builder; `RichText` renders it, links only when http(s), never raw HTML). The
inspector's text box shows the markers and accepts them too.

More sections (migration 0041): **Button** (to a page of the app or a web address; filled, outlined or soft; left,
centre or right), **Quote** (one big quote and who said it) and **Questions & answers** (an FAQ whose answers open on
tap; all open in the builder so they can be edited). The **Image** section gained a caption and a "keep in view when
cropped" choice (object-position). App settings > Theme has a **Footer**: a line of text and social links (Instagram,
TikTok, YouTube, Facebook, X, email, website) drawn at the bottom of every page (`SiteFooter`). The app PATCH's theme
schema now lists `layout` and `footer`; a theme key missing from it is silently dropped on every Save settings.

Site-wide looks (`src/lib/pwa/theme-style.ts`): App settings > Theme offers **Fonts** (nine pairs of Google Fonts, loaded
by a stylesheet link the published layout and the builder frames both add; `font_family` typed by hand still wins for
the body), **Heading size** (Tailwind's `--text-*` variables are rescaled under `[data-heading-size]`, so every heading
follows) and **Buttons** (`--button-radius`; apps that never chose keep today's shapes). Every section has
**Background** (plain, tinted, a wash of the colour) and **Show on** (phones only / computers only: hidden with
viewport classes on the site, shown with a badge in the builder), stored on the section's config as `appearance` and
`show_on` and wrapped by `BlockRenderer`.

## Search, sharing and five more sections (migration 0042)
_Added 2026-10-14._ Every page gained its own **Search & sharing** (a page tab's dropdown menu): a title, a
description and a share picture (`pages.seo_title/seo_description/share_image_url`), read by
`generateMetadata` in the catch-all page route and falling back to the page's name and the app's own description when
left blank. Each published app now serves `/sitemap.xml` (every page's address) and `/robots.txt` (disallows its own
endpoints, points at the sitemap) — both new static routes under `published-apps/[appSlug]/`, added to
`RESERVED_PAGE_PATHS` so a page can't be named "sitemap.xml" by accident.

App settings > Theme gained an **Announcement bar** (a line across the top of every page, with an optional link to a
page or a web address; the visitor's "closed" choice is remembered per announcement text via `localStorage`, read
through `useSyncExternalStore` rather than an effect so it never fights hydration) and a **Cookie notice** (a small
dismissible notice, off by default) — both in `src/components/pwa-runtime/SiteNotices.tsx`, shown in the published
layout and (the announcement bar) in the builder's own preview.

Five more sections: **Picture & words** (a photo beside a heading, words and an optional button, photo on the left or
right), **Newsletter sign-up** (an email box that adds the visitor as one of the app's members — no usable password,
so they never see a sign-in prompt — reachable afterwards from Notifications > Email; `POST /newsletter`), **Share
this page** (Share/Copy link plus X, Facebook, WhatsApp and Email, all pointing at the page the visitor is on), **Map**
(an address, an embedded Google map with no key needed, and a Directions button) and **Audio** (an uploaded recording
with a title, note and player). All five live in `MoreBlocks.tsx` (published/preview view) and `MoreEditors.tsx` (the
inspector), wired into `BlockRenderer`, `Inspector`, `blockMeta.ts` and `block-defaults.ts` the same way as every other
section type.
