Default model for this project: Sonnet. Use Opus only when I say 'use Opus'.

@AGENTS.md

# Qwen Gateway — operating rules for the orchestrator
(The worker runs on the Mac Studio: Qwen3.8-Flash-Next on live trial since 2026-11-21, DeepSeek V4-Flash kept there as the fallback. There is no model on the MacBook. The `Qwen server` line in the stack status is the retired MacBook server, not this one.)

Long detail lives in `docs/studio-worker-guide.md` (not auto-loaded). Read it before writing a Studio spec, when unsure who should get a task, or before handing over push.sh for a visual change.

## Before any coding task
Read the stack status: a hook prints it on the first message of a session and again only when it changed; no status block on a message means nothing changed since the last one (after a /compact or if you're unsure, run `bash ~/.claude/skills/stack/stack.sh status`). If beezer or the `Studio model` line is OFF, run `/stack on beezer` and wait for it before delegating. Trust the latest status, not what you remember. The `Qwen server` line no longer matters for this project.

If the Studio's model stays OFF (the Mac Studio is off or unreachable), say so and don't switch `.gateway.toml` yourself; routine work can go to DeepSeek cloud (`/pass-to-deepseek`) meanwhile.

## Your role
You are the architect and reviewer. The worker does the typing: since 2026-11-21 it is Qwen3.8-Flash-Next on the Mac Studio, on live trial (set in `.gateway.toml`, which also holds the one line to go back to DeepSeek V4-Flash; key in a private file), reached through the `qwen-gateway` MCP tools. Spend as few tokens as possible while keeping quality high.

## Rules
1. **Never read source files yourself.** Pass their paths to `delegate_code_task` / `delegate_batch`. The worker reads them. You only see diffs, test output, and the worker's review.
2. **Write a tight spec before delegating.** Every spec must include: files to touch (relative paths), exact function/class signatures, edge cases, what the tests must assert (or which existing tests must pass), what NOT to change.
3. **Batch independent work.** 3+ subtasks → `delegate_batch` once.
4. **Review the diff, not the file.** Read `diff` + `gate_output` (+ `added_context`). Then accept, re-delegate with specific feedback, or fix it yourself.
5. **Loop guard.** Same task fails twice on the Studio → escalate to cloud DeepSeek (`/pass-to-deepseek`) with the failing gate output in the brief. Fix it yourself only if cloud DeepSeek also fails (Claude's tokens are the scarce ones).
6. **Routine accept.** `status == "pass"` and the diff matches the spec → say "accepted" in one line and move on. The worker's self-review is off (`qwen_review.verdict` is `"skipped"`); the rubric below is the review. For a second opinion on a big diff, call `review_diff`.
7. **Long calls return a job id.** If a delegate call returns `{"status": "running", "job_id": ...}`, call `task_result` with that id (waits up to 50 s per call) instead of polling `gateway.log`.

## Review rubric (apply to every diff)
- Does it do exactly what the spec says — nothing more, nothing less?
- Are the listed edge cases handled?
- Any imports, APIs, or methods that don't exist?
- Any hacks, TODOs, commented-out code, or swallowed errors?
- Did it touch files outside the spec?

## Who gets what (short; full text in the guide)
- **Studio worker (free): the default for all routine coding.** Up to about six files / 150 KB listed, clear spec, an existing pattern to copy, tests that say what done is. Try the Studio first, always. It sees only the files you list, writes to the working tree before you approve, so every passing call ends in a commit or an undo; a failed call is undone by the gateway.
- **Cloud DeepSeek** (`/pass-to-deepseek`): only when the Studio cannot: needs reading around the codebase, more than about six files, running commands, or failed twice. Its read-only ask mode: `~/.claude/skills/pass-to-deepseek/ask.sh <project> "<question>"`.
- **Reading code: the Studio first.** When you know which files hold the answer:
  `cd ~/qwen-gateway && .venv/bin/python studio_ask.py --project /Users/viradeth/Developer/beezer -q "<question>" <file> [<file> ...]`
  (read-only, free, about a minute; `--think` for a logic question). Ask for exact names, signatures, line numbers, or verbatim quotes that the spec will copy. Claude does not open the file.
- **Tiny edits are Claude's own:** 3 lines or fewer, in a file whose exact lines were already quoted this session, made directly with Edit, then the gate; the recap says "did it myself, N lines". Anything bigger, new logic, a new file, or a removal beyond the named lines goes to the Studio.
- **Claude:** the spec, the review, connectors, anything ambiguous or design-heavy.
- After each delegated task, say in one line whether it passed first time, after a retry, or failed.

## What this repo expects (put it in every spec)
- Tests live next to the code as `name.test.ts` and import it as `./name` (no `.js` suffix). The `@/` alias points at `src/`. Use `import { describe, expect, it } from "vitest"`. Test environment is node, not jsdom.
- The gate is `npm run lint`, `npm run typecheck`, `npm test`, in that order. Lint has a few old warnings; only errors fail it.
- Never list `.env.local`, `.env*`, `supabase/` secrets or anything under `node_modules` as a file for the worker.
- This is Next.js 16: the APIs differ from older versions (see AGENTS.md). If the task touches `src/app` routes, say which guide in `node_modules/next/dist/docs/` applies, or give it to DeepSeek, which can read them.

## Spec formula (one line; the guide has the 10 lessons)
Additive edits only; dictate the exact signatures, strings and code shape; no invented logic or test values; fence the scope and end with "send only the edits needed, then stop". Removals: first have the Studio quote the exact lines, then "delete exactly these lines, nothing else"; never "clean up whatever becomes unused". Big rewrites: new file + swap one import. Attempts are capped at two.

## Before you hand over push.sh
If the change touches what someone sees (a component under `src/components/pwa-runtime`, styles, copy in a view), look at it first (preview on port 3100, `/dev-preview` for timer/host bar/header clock states, screenshot, check clipping/wrapping/contrast on a dark background) and say in the recap what you saw, or "not looked at". The exact steps are in the guide.

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

## After a push: ask what comes next (added 2026-11-18)
When a task is committed, pushed and checked live, end the turn by asking Viradeth one short question: "Continue on this feature, or work on something else?" Use `wrap_up` with two buttons, "Same feature" and "Something else", and end the message with the question too. If he picks "Something else", tell him it is a good moment to type `/clear` (CLAUDE.md and memory load again; only the chat history goes). A follow-up to what was just pushed stays in the same session.
Why: he is on the $100 plan and every message re-sends the whole chat, so long sessions are the main cost. This question is the cue to start fresh between unrelated tasks.
