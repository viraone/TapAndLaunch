# BYOB: Bring your own bot (code mode, like Lovable)

_Added 2026-10-05._ A customer pastes their **own** AI key (Anthropic or OpenAI) and builds their app by chatting in the
builder. The AI usage is billed to **their** AI account, so it costs TapAndLaunch nothing. It is the last template in the
picker ("BYOB: Bring your own bot", category `ai`), and "Build with AI" is also available in every app's builder.

## How it works
1. **Key** (`/api/organizations/ai-key`): admins paste a key; the server first calls the provider's *list models* endpoint to
   prove the key works and to pick the model from what the key can actually use (`pickModel`: a Sonnet model for Anthropic,
   the newest general GPT model for OpenAI, so no model names are hard-coded). The key is encrypted (AES-256-GCM,
   `src/lib/ai/keys.ts`) and stored in `org_ai_keys` (migration 0030, no policies: browsers can never read it). Everyone in the
   organization sees only the provider, the model and the last four characters. Settings > AI key shows it and removes it.
2. **Chat** (`POST /api/apps/{id}/ai-chat`): editors send a message; the server sends the app's current pages and blocks plus
   the message to the customer's own model (`BUILDER_SYSTEM_PROMPT`), which answers with JSON: a reply and a list of small
   changes ("ops": add/remove page, add/replace/remove/move block, set theme).
3. **Checked before saved**: the reply must pass `AiReply` (`src/lib/ai/builder-ops.ts`): only ten safe block types, bounded
   text, safe page paths (reserved ones refused), a hex color, photos only by name from `public/templates`. Anything else
   (video, embeds, maps blocks, links) makes the whole reply unusable. The ops are applied to a copy (`applyOperations`); steps
   that don't fit are skipped and reported; the result is saved with the **owner's own session**, so RLS applies to every write.
4. **Builder refresh**: the builder page is keyed on the app's saved version, so it reloads after a change. The chat pauses while
   there are unsaved edits ("Save draft first") because the AI works on the saved app.

## Limits and safety
- 40 chat messages per person per hour (`CHAT_HOURLY_LIMIT`; counted in `ai_generations` with `kind = 'chat'`), so a runaway
  loop can't empty a customer's key. Page and block counts are capped (10 pages, 30 blocks per page).
- Only editors can chat; only admins can add or remove the key.
- The customer's text is passed inside `<owner>` tags with an instruction to treat it as data. Blocks the AI can't edit
  (live maps blocks, class finder...) are marked "can't be changed by chat" and refused if it tries.
- `AI_KEY_SECRET` (optional) encrypts keys; without it the secret is derived from `MEMBER_SESSION_SECRET`. Changing either
  makes saved keys unreadable (customers would paste them again).

## Testing without spending money
Set `AI_TEST_BASE_URL=http://localhost:PORT` in development (ignored in production) and run a stand-in server that answers
`/anthropic/v1/models` and `/anthropic/v1/messages`. The unit tests (`keys.test.ts`, `builder-ops.test.ts`) cover encryption,
the checks and how changes are applied. **Not yet tested against real Claude or ChatGPT**: do one real run with a real key
before announcing this.

## Not built yet
A chatbot for an app's *visitors* (answers customers' questions from the app's pages) is the natural next step: a block that
uses the same saved key, with a per-visitor message limit.

---

## Code mode (the BYOB template): an AI writes a real React app
_Added 2026-10-05._ The BYOB template now creates an app with `apps.kind = 'code'`: instead of blocks, the customer's own AI
writes a React app, shown live next to the chat. The block-based chat above still exists for ordinary apps ("Build with AI").

**Parts**
- `src/lib/code/prompt.ts`: the AI's instructions (a design system, what exists in the sandbox, the answer format) and the
  starter file. Most of the output quality comes from here; edit it to change how apps look.
- `src/lib/code/files.ts`: file rules (paths in `src/`, .jsx/.js/.css, 40 files, 60 KB each, 400 KB total, needs
  `src/App.jsx`), reading the model's tag-based answer (`<reply>`, `<file path>`, `<delete path>`; not JSON, so code never
  needs escaping and it can be read while streaming) and applying changes.
- `src/lib/code/document.ts`: turns the files into one HTML page: React 18 and a few libraries from esm.sh (pinned),
  Tailwind from its CDN, Babel in the browser to turn JSX into JavaScript, an import map of blob URLs so files import each
  other as `@/components/X`, an in-memory `localStorage`, and error reporting to the parent.
- `POST /api/apps/{id}/code-chat`: streams the AI's answer to the browser as it is written (`streamText`), then checks and
  saves a new version with the owner's own session. 30 builds per person per hour (`ai_generations.kind = 'code'`).
- `app_code_versions` (migration 0031): every version's full file set. `apps.code_published_version` is what visitors see,
  so drafts stay private until Publish (a snapshot). Undo = restore, which saves a copy as the newest version.
- `CodeBuilder.tsx`: chat on one side, live sandboxed preview on the other, phone/desktop toggle, version list with restore,
  publish. When the preview reports an error after an AI build, the error goes back to the AI to fix (twice at most, never the
  same error twice), and there's an "Ask AI to fix it" button.

**Speed (added 2026-10-05).** Owners were waiting 27 to 76 seconds, so:
- Builds use the provider's small, quick model (`fastModel`: Claude Haiku, or the `-mini` of the OpenAI model), falling back
  to the model chosen with the key if the provider doesn't have it. There is no quality switch (removed on purpose).
- Changes to an existing app come back as `<edit path><find>…</find><with>…</with></edit>` blocks instead of whole files
  (`applyEdits`). An edit whose `find` isn't found exactly once makes the route ask once for the whole file instead.
- A brand-new app (`isFreshApp`: still the starter file) is built by `src/lib/code/first-build.ts`: the AI writes a
  `<plan>` first (a design line, then `sections: A (shares key), B, C`, which starts every section at once; the older
  one-line-per-file shape still works), then a one-line reply and `src/App.jsx`. Each section starts in
  its own AI call the moment its plan line arrives, so they are written while App.jsx is still being written; anything still
  missing after that (`missingImports`) gets one more round. Each section call is capped at `PART_MAX_TOKENS` (850, about
  2,700 characters) because the model doesn't keep to a requested length; a section that reaches it is ended after its
  last whole element (`salvage` in `partial.ts`) and marked `cut` in the timeline. Sections are self-contained; the
  slowest section sets the total, so the plan splits anything long (a booking form becomes a picker and a details form).
  Split sections share values through `src/lib/shared.js` (`useShared(key, initial)`, written by us, not the AI, and added
  to every new app), named in the plan as "shares: <key>".
- Every new app also gets `src/lib/ui.jsx` (`uiKit`, written by us in the plan's accent color, `accentOf`): `Section`,
  `Heading`, `Button`, `Card`, `Badge`, `Field`, `Success`, plus a ready-made `SiteHeader` (with a phone menu) and
  `SiteFooter` that App.jsx places, so the AI doesn't write a header or footer section (those were often the biggest). A form field is one line instead of ~400 characters, which
  matters because the slowest section (usually a form) sets the build time; measured on a real build, a 4-field form was
  4 KB, 36% of it class names. The plan lists the heaviest sections first, in short lines, so they start earliest.
- A request that hasn't started answering after 2.5s (the plan) or 2s (a section) is sent again and the first to answer
  is kept (`hedge`); a real build once waited 11.3s for the plan's first word where ~1.3s is usual.
- Each build's timeline is saved in `ai_generations.details` (migration 0032): the model that answered, total time,
  when our checks were done (`lookupsDone`), how many requests were sent again (`hedges`), when the plan finished, and
  each section's start / first text / done / size / whether it was `cut`. Read it to see where time goes. Their
  output is streamed to the browser as whole `<file>` blocks, held back while the plan step is inside a `<file>` or
  `<reply>`, and announced with `<writing path="…"/>` lines.
- Sections stream onto the screen while they are written (added 2026-10-05). Each section's text is forwarded as
  `<tl-chunk path>` pieces 10 times a second (`demux` in `protocol.ts` takes them out before the rest is read).
  `runnablePartial` (`src/lib/code/partial.ts`) cuts a half-written file at the last point inside JSX children and closes
  what is open (elements, brackets, `a ? (` gets `: null`); its default export is wrapped so an error shows the placeholder.
  Checked against every 5th-character cut of 72 real AI-written sections (35,271 shown, all parse). Until App.jsx arrives,
  the builder stacks the planned sections; before any is planned it shows "Planning your app…".
- The preview page is loaded once (`buildCodeDocument`), and every later version (each moment of a build, the saved
  result, an old version) is posted into it (`{source:"tl-builder", type:"files", rev, files, stubs}`) and swapped in
  place: the app's files become blob modules that import each other by address (libraries stay in the import map), a
  file whose source didn't change isn't compiled again, and animations are skipped while drafting. Messages from the page
  carry `rev`, so news about a replaced version is ignored. Known limit: files that import each other in a loop aren't
  supported (the browser reports an error, which goes to the AI).
- Changes go through the same builder (`firstBuild` with `mode: "change"`). The change request (`userMessage`) tells the AI:
  small change -> `<edit>` blocks (handed back as `small` and applied as before, with the whole-file retry if an edit
  doesn't match, now also sent again when slow); big change (new sections, a different kind of app) -> a plan naming
  only the new sections plus the complete new App.jsx, and those sections are written in parallel. The app's own
  building blocks are kept, the shared-state file is added if missing, and section files App.jsx no longer reaches are
  removed (`unusedComponents`). Real big changes took 16-20s written one after another.
- (Before streaming) The preview fills in while the AI writes: as soon as App.jsx exists, the page shows the real layout with shimmering
  placeholders for sections not written yet (`buildCodeDocument(…, { stubs: true })`), and each section appears as it lands.
  Errors from those half-written pages are ignored (every page message carries a `doc` id).
- Anthropic prompt caching on the long instructions. The mic sends what was said as soon as speaking stops.
- Measured locally against a stand-in tuned to a real key's speed (0.7s to first word, ~500 characters a second): layout at
  about 4s, the whole first app rendered at about 7.4s (was 27s). Small edits take a few seconds.

**Security.** AI-written code runs in `<iframe sandbox="allow-scripts allow-forms allow-popups allow-modals">` (no
`allow-same-origin`), so it has an opaque origin and can't read TapAndLaunch cookies or storage or reach other apps. Published
apps are served by `/app-code` with the header `Content-Security-Policy: sandbox ...` as well, so even opening that address
directly keeps it sandboxed. Published code apps move to their own domain once `NEXT_PUBLIC_CODE_APPS_DOMAIN` is set,
and anyone can report one; admins can take one down. See `docs/moderation.md`.

**Not built yet (stages 2 and 3):** a backend. Apps keep data in React state only (resets on reload). Stage 2 is letting the
customer paste their own Supabase project URL and key so the AI can build tables, sign-in and real data against it. Stage 3:
click an element in the preview to edit it, GitHub export, image upload. First real-key runs (2026-10-05) looked good; the
parallel first build has only been timed against a stand-in so far.


## Stage 2: the app's own database (added 2026-10-05)
An AI-built app can connect the owner's own Supabase project. Builder: **Database** button (badge = setup files not
run yet) -> `DatabasePanel`. API: `/api/apps/{id}/backend` (GET status + setup files, PUT connect, PATCH mark a setup
file run, DELETE disconnect). Table `app_backends` (migration 0034, editors only by RLS).

- Only the project's **public** key is stored (`anon` JWT or `sb_publishable_`). The secret key is refused in both formats
  (`checkBackendInput`). On the live site the URL must be `https://<ref>.supabase.co`, because our server calls it to check
  the connection (`verifyBackend` reads `/auth/v1/settings`, which also tells us whether sign-ups must confirm email).
- Connecting writes `src/lib/supabase.js` (`supabaseFile`) as a new version. It's ours: the code-chat route restores it
  after every build. The app's code talks to the project straight from the visitor's browser (the sandbox's origin is
  `null`; Supabase answers `Access-Control-Allow-Origin: *`), so the owner's row-level security is what protects data.
- The AI gets `backendRules` (in `userMessage`, `planMessage` with `DATABASE_PLAN`, and every section's `partMessage`):
  tables in new `db/NNN_name.sql` files (never edit run ones), RLS + policies always, `supabase.from(...)`, email/password
  sign-in only, a friendly "run the setup" card when a table is missing. A new app's plan names the tables before the
  sections, and the plan step writes `db/001_init.sql` before App.jsx (the early stop lets `db/` files through).
- Setup files aren't part of the running app (the runtime and `buildCodeDocument` skip anything outside `src/`). The
  owner copies each into their SQL editor and clicks "I ran it" (`applied_sql`, by content hash, so an edited file shows
  "Changed since you ran it").
- Sign-ins: a sandboxed page can't store anything, so `window.__tlStorage` asks the page around it over postMessage. The
  builder keeps sign-ins in memory (you stay signed in while the app rebuilds); a published app's `CodeAppFrame` keeps
  them in its own `localStorage` under `tlapp:` (each app has its own address, so its own storage).
- Tested end to end against the local Supabase: connect, build, "not set up yet", run setup, save a task, edit (still
  signed in), publish, visitor signs in, reload (still signed in).

**Not built yet:** running the setup for the owner (would need their access token), magic-link / social sign-in (need
redirects), file uploads (Supabase Storage).
