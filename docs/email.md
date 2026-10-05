# Email

_Last checked: 2026-10-03._ Sending and receiving are handled by two different services.

## Sending (Resend)

| What | How |
|---|---|
| Builder sign-up confirmation, password and auth emails | Supabase Auth, using **Resend as its SMTP server** (`smtp.resend.com:465`, sender `noreply@tapandlaunch.com`). Configured in Supabase > Authentication > SMTP |
| App-level email (the Email channel on a Notifications page) | Resend **batch** API (100 per call), needs `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Vercel. **Set on production 2026-10-05** (key is Sensitive, Production only; a live test email reached the inbox). Sent as `"App name" <noreply@tapandlaunch.com>`, the merchant's message is HTML-escaped, and every email has an unsubscribe link plus the one-click `List-Unsubscribe` header |
| Card receipts | Sent by Stripe, from the builder's own Stripe account (live mode only) |
| StageTime sign-in codes | The *rickshaw-open-mic* Supabase project, also through Resend, sender `noreply@stagetimepnw.com` |

The domain `tapandlaunch.com` is verified in Resend. Its sending records live on sub-names (`send` and
`resend._domainkey`), so they do not clash with the receiving records below.

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

**Only one SPF (`v=spf1`) record per name.** If another service ever needs to send mail *from the root* (for example Google
Workspace), merge it into the existing root SPF line instead of adding a second one.

Check what the world sees: `dig MX tapandlaunch.com` and `dig TXT tapandlaunch.com`.

## Ideas not built yet

An agent that reads support email and drafts replies for the owner to approve was discussed (2026-10-03) but not built.
