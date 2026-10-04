# Runbooks

_Last checked: 2026-10-03._ Step-by-step instructions for routine jobs.

## Add or change a production setting (Vercel)

1. vercel.com > project **tap-and-launch** > Settings > **Environment Variables** > Add Environment Variable.
2. Key = the exact name from [environment-variables.md](environment-variables.md). Value = paste it. Type **Secret** for
   anything secret. Environments: **Production** (and Preview if you test there).
3. Several at once: paste `NAME=value` lines into the Key box, or use **Import .env**.
4. Save, then **Redeploy** (Deployments > top row `...` > Redeploy). For `NEXT_PUBLIC_` names, leave
   **Use existing Build Cache** unchecked.
5. Never paste the value into chat, docs or code. Copy it to the clipboard and paste it straight into Vercel.

## Add a DNS record

1. vercel.com > **Domains** (team menu, next to Projects) > `tapandlaunch.com` > DNS Records.
2. In the form: leave **Name** empty for the root domain (or type a sub-name), pick the **Type**, type the **Value**, and
   for MX type a **Priority**. Click **Add**, once per record.
3. Do not edit the existing Resend records (`send`, `resend._domainkey`).
4. Check from a terminal: `dig +short MX tapandlaunch.com`, `dig +short TXT tapandlaunch.com`.

## Test a card payment in the sandbox

Needs `STRIPE_SECRET_KEY` set to a **sandbox** key (it starts `sk_test_`); the Payments card then shows "Test mode".

1. Use a throwaway builder account (a `+label` Gmail address works), create an organization, an **Online store** app with a
   product of at least $0.50, and publish it.
2. Settings > Payments > keep United States > **Connect Stripe**. On Stripe's pages use test data:
   - Two-step login: choose "Enter code manually instead" and use any authenticator app with the shown key (or compute the
     6-digit code from it).
   - Business type: Unregistered business; EIN: No.
   - Date of birth `01/01/1901`, SSN last 4 `0000` (full `000-00-0000` if asked), street `address_full_match`,
     phone `000 000 0000`, code `000000`.
   - Website `https://accessible.stripe.com`. Bank: "Enter test bank account credentials", routing `110000000`,
     account `000123456789`.
   - ID verification: **Simulate** > Successful verification.
   - Optional screens (Radar, Climate, Tax): any choice; they do not affect payments.
3. Back in Settings, wait for **Payments are on** (usually under a minute; the page re-checks Stripe on each visit).
4. Open the published app, Order the product, pay with `4242 4242 4242 4242` (any future date, CVC, ZIP), untick
   "Save my information".
5. Expect "Payment received" on the product and the order as **Paid · Card payment** on the Orders page. Confirm the webhook
   delivered in Stripe (Developers > Webhooks > the endpoint).

Do not use these test values in a **live** account; they fail verification.

## Reset StageTime test requests

Claude Code skill `reset-stagetime-test` (on the owner's Mac) deletes only the owner's own test addresses from the request
list. Test rows already copied to the Google Sheet are not removed; delete those by hand.

## Phone preview (local code on a real phone)

1. Mac and phone on the same Wi-Fi.
2. `npm run dev:phone` (port 3101; serves the StageTime app on the Mac's plain IP address).
3. On the phone: `http://{Mac IP}:3101/signup?preview=selected`. Stop the server when done.

## Local development

```bash
open -a Docker && supabase start   # local database
npm run dev -- -p 3100             # http://localhost:3100 and http://{slug}.localhost:3100
```

If pages suddenly return 500 with "Parsing CSS source code failed", see [known-issues.md](known-issues.md).
