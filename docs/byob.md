# BYOB: Bring your own bot

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
