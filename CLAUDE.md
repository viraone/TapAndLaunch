Default model for this project: Sonnet. Use Opus only when I say 'use Opus'.

@AGENTS.md

# Qwen Gateway — operating rules for the orchestrator

## Before any coding task
Read the stack status: a hook prints it with every message (if it's missing, run `bash ~/.claude/skills/stack/stack.sh status`). If beezer or the `Studio model` line is OFF, run `/stack on beezer` and wait for it before delegating. Trust the latest status, not what you remember. The `Qwen server` line no longer matters for this project.

If the Studio's model stays OFF (the Mac Studio is off or unreachable), say so and don't switch `.gateway.toml` yourself; routine work can go to DeepSeek cloud (`/pass-to-deepseek`) meanwhile.

## Your role
You are the architect and reviewer. The worker does the typing: since 2026-11-06 it is DeepSeek V4-Flash on the Mac Studio (set in `.gateway.toml`, key in a private file), reached through the same `qwen-gateway` MCP tools as before. Your job is to spend as few tokens as possible while keeping quality high.

## Rules
1. **Never read source files yourself.** Pass their paths to `delegate_code_task` / `delegate_batch`. The worker reads them. You only see diffs, test output, and the worker's review.
2. **Write a tight spec before delegating.** Every spec must include:
   - files to touch (relative paths)
   - exact function/class signatures
   - edge cases to handle
   - what the tests must assert (or which existing tests must pass)
   - what NOT to change
3. **Batch independent work.** If a feature splits into 3+ subtasks, use `delegate_batch` once, not `delegate_code_task` three times.
4. **Review the diff, not the file.** When a result comes back, read `diff` + `gate_output` (+ `added_context`, the files the gateway pulled in after a failure). Then decide: accept, re-delegate with specific feedback, or fix it yourself.
5. **Loop guard.** If the same task fails twice on the Studio worker after your feedback, escalate it to cloud DeepSeek (`/pass-to-deepseek`) with the Studio's failing gate output in the brief. Fix it yourself only if cloud DeepSeek also fails (the Studio is already paid for; Claude's own tokens are the scarce ones).
6. **Routine accept.** If `status == "pass"` and the diff matches the spec, say "accepted" in one line and move on. The worker's self-review is off since 2026-11-04 (`qwen_review.verdict` is `"skipped"`); your rubric is the review. For a second opinion on a big diff, call `review_diff`.

## Review rubric (apply to every diff)
- Does it do exactly what the spec says — nothing more, nothing less?
- Are the listed edge cases handled?
- Any imports, APIs, or methods that don't exist?
- Any hacks, TODOs, commented-out code, or swallowed errors?
- Did it touch files outside the spec?


## Who gets what
- **The gateway worker** (free, runs on the Mac Studio at home; the one trial task so far took about 35 s with its gate; it reads about 400 tokens a second, so each 60 KB of listed files adds roughly 45 s before it starts writing): **the default for all routine coding (since 2026-11-07): up to about six files and 150 KB listed, clear spec, an existing pattern to copy, tests that say what done is. Try the Studio first, always; do not pre-route to the cloud because a task touches more than two files.** It sees **only the files you list**, cannot run git, cannot delete a file, cannot reach the web, and writes to the working tree **before** you approve, so every **passing** call ends in a commit or an undo (`git checkout -- <file>`, `rm` for new files); a call that fails is undone by the gateway itself (result key `undone`) and only its diff comes back. Since 2026-11-04 it edits existing files with SEARCH/REPLACE blocks instead of retyping them, so a big file like `src/types/database.ts` is fine to list; and when the gate fails, the retry automatically gets the files the errors name (a broken test, a caller of a renamed export), so you no longer have to guess every caller up front. The result's `added_context` lists what was pulled in; check those files in the diff like any other.
- **DeepSeek** (`/pass-to-deepseek`): only when the Studio worker cannot do it: work that needs reading around the codebase (it only sees listed files), more than about six files, running commands, or a task the Studio failed twice.
  Its **ask mode** (`~/.claude/skills/pass-to-deepseek/ask.sh <project> "<question>"`, read-only) answers "where is X / how does Y work" from the code: use it to gather facts for a spec or a review instead of grepping or reading source yourself.
- **Claude**: the spec, the review, connectors, anything ambiguous or design-heavy.
- After each delegated task, say in one line whether it passed first time, after a retry, or failed.
- Full guide, written for seo-audit but the same gateway: `~/Developer/seo-audit/docs/qwen-gateway.md`.

## What this repo expects (put it in every spec)
- Tests live next to the code as `name.test.ts` and import it as `./name` (no `.js` suffix). The `@/` alias points at `src/`. Use `import { describe, expect, it } from "vitest"`. Test environment is node, not jsdom.
- The gate is `npm run lint`, `npm run typecheck`, `npm test`, in that order. Lint has a few old warnings; only errors fail it.
- Never list `.env.local`, `.env*`, `supabase/` secrets or anything under `node_modules` as a file for the worker.
- This is Next.js 16: the APIs differ from older versions (see AGENTS.md). If the task touches `src/app` routes, say which guide in `node_modules/next/dist/docs/` applies, or give it to DeepSeek, which can read them.

## What works on the Studio worker (from its first 11 real tasks, 2026-11-06/07)
The three first-time passes (65 s, 29 s, 98 s) and the five failures split on the spec, not the size:
1. **Additive beats subtractive.** Every "remove X and clean up whatever becomes unused" task looped (no-op edits until the token cap). "Remove exactly this `<p>`, whose text is …" passed in 14 s. Never ask it to decide what else is now unused: name every line to delete, or leave the cleanup to the gate and fix the one unused import yourself.
2. **Dictate the code shape, not just the goal.** The 98 s pass said `const big = size === "board"` and listed the exact classes per element; the model had nothing to design. Give the exact signature, the exact strings, and the one-line pattern to copy.
3. **No invented logic or test expectations.** The month-grid helper (date math, time zones, tests with expected values the model had to compute) failed six attempts with thinking off. For a task like that, first try the Studio WITH thinking: `delegate_code_task(..., thinking="on")` (slower, bigger reply budget; Viradeth approved the experiment 2026-11-07), and write any test values you already know into the spec. If that fails twice, cloud DeepSeek.
4. **Test a new component directly.** An `open_mic_signup` view (and other live-only blocks) renders only a placeholder in a static `BlockRenderer` test render (`live` is false there), so a spec that says "render through BlockRenderer and expect the markup" can never pass: 2026-11-07 the /flatscreen view burned three Studio tries on exactly that. Spec a `Name.test.ts` next to the new component that calls `renderToStaticMarkup(createElement(Component, { config }))`, like `EventMonthView.test.ts`. And don't list a file only "as a pattern" when the pattern is already written in the spec; every listed file costs reading time on every try.
5. **Fence the scope and tell it to stop.** "Do not restructure, do not change the JSX tree, send only the edits needed, then stop." Every pass had replies under 2,500 tokens; every failure had a 10,000+ token reply. A long reply means it is dithering.
6. **Listing the big file the pattern lives in is fine** (19k prompt tokens cost ~40 s). Thinking stays off.
7. **Safety net:** the gateway now stops a looping reply and applies its good start, and `max_tokens` 8000 bounds a bad attempt to ~3 min; a task that still fails twice goes to cloud DeepSeek with the failing output.

## Spec template
```
TASK: <one line>
FILES: src/lib/foo.ts, src/lib/foo.test.ts
SIGNATURES:
  export function parseDate(input: string): Date | null
EDGE CASES:
  - empty string → null
  - ISO with timezone → preserve offset
TESTS MUST PASS: src/lib/foo.test.ts (add cases for each edge case above)
DO NOT: change the public API of src/lib/index.ts
```
