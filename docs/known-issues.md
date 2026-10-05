# Known issues and surprises

_Last updated: 2026-10-03._

## The repo used to live in iCloud (fixed 2026-10-04)

The repo was in `~/Desktop`, which macOS syncs to iCloud ("Desktop & Documents"). With several sessions editing at once,
iCloud saved conflict copies named "... 2.ts" (49 in the source, 3,497 inside `node_modules`), which broke
`supabase migration list`, `/push` and the typecheck, and once appeared to wipe `node_modules`.

**Fix:** the repo now lives at **`~/Developer/beezer`**, outside iCloud. `~/Desktop/beezer` is a shortcut (symlink) to it
so older tools and running sessions keep working. `/push` and the reset skill point at the real path. Claude's project
memory for the new path is a link to the old memory folder, so memory carries over.

**If " 2" files ever come back** (for example if the repo is moved into a synced folder again), delete them only after
checking each is identical to its original:

```bash
git ls-files --others --exclude-standard | grep " 2\." | while IFS= read -r f; do
  cmp -s "$f" "${f/ 2./.}" && rm -- "$f" || echo "differs, check by hand: $f"; done
find . -type d -name "* 2" -empty -not -path "./node_modules/*" -delete
```

If `node_modules` has "* 2" folders, delete it and run `npm ci`.

**Still in iCloud:** other folders on the Desktop, such as `beezer-livebites` (a git worktree for FitnessNav), can hit the
same problem. Move them to `~/Developer` too, then run `git worktree repair` from the main repo.

## Local pages return 500: "Parsing CSS source code failed"

The dev server's build cache got corrupted. Stop the dev server, delete `.next/` (or `.next-phone/` for the phone preview), and
start it again. The code is not the problem.

## Push sent but nothing appears

The dashboard says "N sent", which means the push services accepted it. If nothing shows on a Mac:

- System Settings > **Notifications** > **Google Chrome** (and Firefox): Allow Notifications is often **off** by default.
  Turn it on, style Banners.
- **Focus / Do Not Disturb** (moon icon) hides everything.
- Chrome: `chrome://settings/content/notifications` must allow the app's site.

## Notification send times show UTC

The "Recent sends" list on a Notifications page shows server (UTC) time, e.g. 5:35 PM for 10:35 AM in Seattle. Cosmetic.

## Stripe surprises

- Creating connected accounts with the old v1 API is refused for new integrations: use Accounts v2.
- v2 requires the **country** before the merchant configuration; the Connect card asks for it.
- Right after onboarding, card payments stay "restricted" for a few seconds to a minute while Stripe checks. The card shows
  "Stripe is checking your details".
- The checkout page's "Save my information" (Link) rejects fake phone numbers; untick it when testing.
- Browser autofill can put real personal details into sandbox forms. Use the test values on purpose.

## A mistyped email shows a vague error

Typing an address without `.com` on the StageTime sign-in shows "Something went wrong. Try again." instead of "Check that your
email address is right." (recorded in the test plan as AUTH-EML-001).
