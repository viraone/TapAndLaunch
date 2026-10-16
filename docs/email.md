# Email

_Last checked: 2026-10-03._ Sending and receiving are handled by two different services.

## Sending (Amazon SES for sign-in emails, Resend for the rest)

| What | How |
|---|---|
| Builder sign-up confirmation, password and auth emails | Supabase Auth, using **Amazon SES as its SMTP server** (`email-smtp.us-west-2.amazonaws.com:465`, region US West (Oregon), sender `noreply@tapandlaunch.com`). Configured in Supabase > Authentication > Emails > SMTP Settings. Switched from Resend on 2026-10-16 after Amazon approved production access (the shared Resend free plan allows only 100 emails a day). The SMTP user name and password are an IAM user (`ses-smtp-user...`, permission `ses:SendRawEmail` only); the file is kept privately by the owner and the password cannot be viewed again, only replaced by creating new credentials (SES > SMTP settings > Create IAM credentials). The confirmation and reset links go to `/auth/confirm`, so they work on any device. |
| App-level email (the Email channel on a Notifications page) | Resend **batch** API (100 per call), needs `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel. **Set on production 2026-10-05** (key is Sensitive, Production only; a live test email reached the inbox). Sent as `"App name" <noreply@tapandlaunch.com>`, the merchant's message is HTML-escaped, and every email has an unsubscribe link plus the one-click `List-Unsubscribe` header |
| Card receipts | Sent by Stripe, from the builder's own Stripe account (live mode only) |
| StageTime sign-in codes | The *rickshaw-open-mic* Supabase project, also through Resend, sender `noreply@stagetimepnw.com` |

The domain `tapandlaunch.com` is verified in both Resend and Amazon SES (Oregon). Each service's sending records live on their own
sub-names (`send` and `resend._domainkey` for Resend; three `<token>._domainkey` CNAMEs for SES), so they do not clash with the
receiving records below. Rolling back sign-in emails to Resend means putting `smtp.resend.com`, port 465, user `resend` and a
Resend sending key back into the same Supabase screen.

### App email: unsubscribe and limits
- The footer link goes to `https://{app}.tapandlaunch.com/unsubscribe?m=<member>&t=<signed token>` (token = HMAC with
  `MEMBER_SESSION_SECRET`, so it needs no login). GET only shows a button; POST unsubscribes, which also serves the
  one-click header. `/unsubscribe` is a reserved page path.
- Unsubscribed members (`app_members.email_unsubscribed_at`) are skipped by the Email channel; the Members page labels them.
  Sign-in and account emails are separate and not affected.
- Resend's free plan: 100 emails a day, 3,000 a month. A batch fails or succeeds as a whole, so a quota error shows as "failed".

## Receiving (ImprovMX, free plan)

Mail sent to **any address @tapandlaunch.com** (a catch-all, so `support@`, `hello@`, anything) is forwarded to the owner's
inbox. Set up 2026-10-03; a test email to `support@tapandlaunch.com` arrived the same day.

- Manage it at improvmx.com (Aliases tab). Add specific aliases if the catch-all attracts spam.
- Replies currently come **from the owner's personal address**. Sending *as* `support@tapandlaunch.com` needs either
  ImprovMX's paid plan (SMTP) or a mailbox service such as Google Workspace.

## DNS records (Vercel > Domains > tapandlaunch.com > DNS Records)

| Name | Type | Value | Priority | For |
|---|---|---|---|---|
| (blank, the root) | MX | `mx1.improvmx.com` | 10 | Receiving (ImprovMX) |
| (blank) | MX | `mx2.improvmx.com` | 20 | Receiving (ImprovMX) |
| (blank) | TXT | `v=spf1 include:spf.improvmx.com ~all` | | SPF for the root |
| `send` | MX | `feedback-smtp.us-east-1.amazonses.com` | 10 | Resend bounce handling |
| `send` | TXT | `v=spf1 include:amazonses.com ~all` | | SPF for Resend |
| `resend._domainkey` | TXT | (Resend's DKIM key) | | Resend signing |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@tapandlaunch.com` | | DMARC, report only (added 2026-10-16) |
| `wdis73gw736i5vsl3zp5tyvnoe3pnmun._domainkey` | CNAME | `wdis73gw736i5vsl3zp5tyvnoe3pnmun.dkim.amazonses.com` | | Amazon SES DKIM (added 2026-10-16) |
| `zcwkh3ipb24fwcvkgzzbxn2nchmzqsx4._domainkey` | CNAME | `zcwkh3ipb24fwcvkgzzbxn2nchmzqsx4.dkim.amazonses.com` | | Amazon SES DKIM |
| `oy3sgeg53wzsonlteocqewfkgqiata6m._domainkey` | CNAME | `oy3sgeg53wzsonlteocqewfkgqiata6m.dkim.amazonses.com` | | Amazon SES DKIM |

**Only one SPF (`v=spf1`) record per name.** If another service ever needs to send mail *from the root* (for example Google
Workspace), merge it into the existing root SPF line instead of adding a second one.

Check what the world sees: `dig MX tapandlaunch.com` and `dig TXT tapandlaunch.com`.

## Amazon SES (sign-in emails)

- Account: the owner's AWS account, region **US West (Oregon) us-west-2**. The domain identity `tapandlaunch.com` uses Easy DKIM
  (RSA 2048) and no custom MAIL FROM, so SPF is checked against `amazonses.com` and DMARC alignment comes from DKIM. Production
  access was granted on 2026-10-16. Pricing is roughly $0.10 per 1,000 emails.
- Checked live on 2026-10-16: a sign-up confirmation arrived in 4 seconds, sent from `a27-35.smtp-out.us-west-2.amazonses.com`,
  DKIM pass for `tapandlaunch.com`, SPF pass.
- DMARC (added 2026-10-16): a TXT record at `_dmarc` with `v=DMARC1; p=none; rua=mailto:dmarc@tapandlaunch.com`. It only reports, so no mail is blocked. Daily summary reports arrive through the ImprovMX catch-all. After three or four weeks of reports with every sender passing (Amazon SES and Resend both sign with `tapandlaunch.com`), move to `p=quarantine`. Do not tighten it before checking the reports.
- App-level email (the Notifications email channel) and StageTime sign-in codes still use Resend and its free-plan limits.
  Moving the app-level email to SES would be a code change.

## Ideas not built yet

An agent that reads support email and drafts replies for the owner to approve was discussed (2026-10-03) but not built.
