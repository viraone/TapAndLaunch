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
   picture always matches what the customer gets. Templates that need live maps data (Food finder, Gas prices) show last, as
   "Not on yet", and a group with nothing usable is hidden.
4. Creating an app lands in the builder, where the **Get live** checklist is: Create, Add your content, **Pick your colors and
   icon** (ticks when an icon is uploaded or colors are saved in App settings: `theme.looks_confirmed`), Publish, **Scan the QR
   code** (opens the app's page, which has the QR code; ticks when someone opens the app).

## Showcase templates
"Gym or studio" and "Restaurant or café" open as finished-looking apps: a photo banner with a button, a strip of highlights,
a menu or membership price list, a photo gallery, reviews and opening hours, in a style of their own (the gym is dark with a
red accent, the restaurant warm cream with burnt orange), with a tab bar. The gym also creates six sample classes for the next
week (`StarterEvent`, `sampleEventRows`, placed in Pacific time), each marked as a sample. The six showcase blocks are in
`src/components/pwa-runtime/ShowcaseBlocks.tsx` (editors in `builder/blocks/ShowcaseEditors.tsx`), photos in
`template-photos.md`. The other nine templates still use the plain blocks.

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
