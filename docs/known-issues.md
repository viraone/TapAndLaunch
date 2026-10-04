# Known issues and surprises

_Last updated: 2026-10-03._

## Duplicate files named "... 2.ts" appear in the repo

**Cause:** the repo lives in `~/Desktop`, and macOS iCloud syncs the Desktop folder ("Desktop & Documents" is on). When files
change quickly, especially with more than one session or worktree, iCloud saves conflict copies with " 2" in the name.

**Why it matters:** Supabase counts `0019_x 2.sql` as a second migration, so `/push` could fail or try to apply a migration
twice. They also clutter `git status`.

**Fix:** delete them after checking each is identical to its original:

```bash
git ls-files --others --exclude-standard | grep " 2\." | while IFS= read -r f; do
  cmp -s "$f" "${f/ 2./.}" && rm -- "$f" || echo "differs, check by hand: $f"; done
find . -type d -name "* 2" -empty -not -path "./node_modules/*" -delete
```

**Lasting fix:** move the repo out of iCloud, for example to `~/Developer/beezer`. The `/push` and reset skills and Claude
Code's project memory refer to `~/Desktop/beezer`, so update them in the same step.

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
