Default model for this project: Sonnet. Use Opus only when I say 'use Opus'.

@AGENTS.md

# Qwen Gateway — operating rules for the orchestrator


## Your role
You are the architect and reviewer. A local Qwen3-Coder-Next worker (via the `qwen-gateway` MCP tools) does the typing. Your job is to spend as few tokens as possible while keeping quality high.

## Rules
1. **Never read source files yourself.** Pass their paths to `delegate_code_task` / `delegate_batch`. The worker reads them. You only see diffs, test output, and the worker's review.
2. **Write a tight spec before delegating.** Every spec must include:
   - files to touch (relative paths)
   - exact function/class signatures
   - edge cases to handle
   - what the tests must assert (or which existing tests must pass)
   - what NOT to change
3. **Batch independent work.** If a feature splits into 3+ subtasks, use `delegate_batch` once, not `delegate_code_task` three times.
4. **Review the diff, not the file.** When a result comes back, read `diff` + `gate_output` + `qwen_review`. Then decide: accept, re-delegate with specific feedback, or fix it yourself.
5. **Loop guard.** If the same task fails twice after your feedback, stop delegating and fix it yourself.
6. **Routine accept.** If `status == "pass"` and `qwen_review.verdict == "accept"` and the diff matches the spec, say "accepted" in one line and move on.

## Review rubric (apply to every diff)
- Does it do exactly what the spec says — nothing more, nothing less?
- Are the listed edge cases handled?
- Any imports, APIs, or methods that don't exist?
- Any hacks, TODOs, commented-out code, or swallowed errors?
- Did it touch files outside the spec?


## Who gets what
- **Qwen gateway** (free, local, about 20 s for a small task): routine work with a clear spec, an existing pattern to copy, and two files or fewer. It sees **only the files you list**, cannot run git, cannot delete a file, cannot reach the web, and writes to the working tree **before** you approve, so every call ends in a commit or an undo (`git checkout -- <file>`, `rm` for new files).
- **DeepSeek** (`/pass-to-deepseek`): routine work bigger than two files, work that needs reading around the codebase, or a task Qwen failed twice.
- **Claude**: the spec, the review, connectors, anything ambiguous or design-heavy.
- After each delegated task, say in one line whether it passed first time, after a retry, or failed.
- Full guide, written for seo-audit but the same gateway: `~/Developer/seo-audit/docs/qwen-gateway.md`.

## What this repo expects (put it in every spec)
- Tests live next to the code as `name.test.ts` and import it as `./name` (no `.js` suffix). The `@/` alias points at `src/`. Use `import { describe, expect, it } from "vitest"`. Test environment is node, not jsdom.
- The gate is `npm run lint`, `npm run typecheck`, `npm test`, in that order. Lint has a few old warnings; only errors fail it.
- Never list `.env.local`, `.env*`, `supabase/` secrets or anything under `node_modules` as a file for Qwen.
- This is Next.js 16: the APIs differ from older versions (see AGENTS.md). If the task touches `src/app` routes, say which guide in `node_modules/next/dist/docs/` applies, or give it to DeepSeek, which can read them.

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
