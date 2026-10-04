# Deploying

_Last checked: 2026-10-03._

## The rule

Work happens on a **branch**. It is shown and tested locally. It reaches production only when the owner types **`/push`**
in Claude Code. Pushing to `master` is what deploys: Vercel builds every commit on `master`.

## What `/push` does

`/push` is a personal Claude Code skill on the owner's Mac (`~/.claude/skills/push/push.sh`, not in this repo). In order, and
it stops at the first problem:

1. Refuses if there are uncommitted changes.
2. Runs the typecheck (`tsc`), lint (`eslint src`) and unit tests (`vitest run`).
3. Lists migrations that production does not have yet. **Stops** if one looks destructive (drop, truncate, delete). Otherwise
   applies them to production with `supabase db push --linked`.
4. Fast-forwards `master` to the branch (never a force push) and pushes both to GitHub.
5. Waits for Vercel's deploy status on that commit (up to 10 minutes).
6. Checks that `https://tapandlaunch.com/login` and `https://stagetimepnw.tapandlaunch.com/signup` answer.

Database changes therefore go live **before** the code that uses them, which is why migrations must be additive.

## Checks you can run yourself

```bash
npx tsc --noEmit -p .   # types
npx eslint src          # lint
npx vitest run          # unit tests (src/**/*.test.ts)
npx next build          # full production build (push does not run this; do it for risky changes)
```

## Settings changes

- Changing a Vercel environment variable does **not** redeploy. Redeploy from Vercel: Deployments > the top row's `...` >
  Redeploy. For `NEXT_PUBLIC_` values, leave **Use existing Build Cache unchecked**.
- Supabase Auth settings and Stripe dashboard settings take effect immediately and are not part of a deploy.

## Rolling back

In Vercel, Deployments > pick the last good deployment > `...` > **Promote to Production** (or Instant Rollback). This puts
the old code back but does **not** undo database migrations; that is another reason migrations stay additive.

## Branch naming

Short and descriptive: `stripe-payments`, `push-click-fix`, `legal-pages`. One topic per branch, so `/push` ships only what
was reviewed.
