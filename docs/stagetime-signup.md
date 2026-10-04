# StageTime PNW sign-up (Read The Room)

_Last checked: 2026-10-03._ The weekly open-mic sign-up for the Read The Room show, moving from stagetimepnw.com to
`https://stagetimepnw.tapandlaunch.com/signup`. **Planned full launch: Friday Oct 23, 2026** (final test round Thu Oct 22).

## What a comic sees

- Requests are open from **Friday 9:40 PM until Thursday 10:00 PM** (Seattle time). The page shows the next show date and an
  "Open" pill.
- They sign in with an **emailed 6-digit code** (no password), then fill one request form (stage name, Instagram, performed
  before, two agreements) and see the "on the request list" card.
- Thursday 10 PM to Friday 6 AM: requests are closed and the page says so.
- Friday from 6 AM until requests reopen, signed-in comics see their status ("You're in!", or a kind not-selected message) and
  the lineup. Signed-out visitors never see names.
- Each Friday at 9:40 PM a scheduled job clears last week's requests.

## How it is built

| Part | Where |
|---|---|
| The page (a block of type `open_mic_signup` on the StageTime app) | `src/components/pwa-runtime/OpenMicSignupRuntime.tsx`; window and show-day logic in `src/lib/openmic/` |
| The request list, sign-in, settings | Supabase project **rickshaw-open-mic** (table `signups`). A database trigger rejects requests outside the window. Visitors can only read request ids; a signed-in comic reads only their own request (2026-10-03) |
| Lineup (who is on, how long, what time) | The host fills in a Google Sheet. The `lineup-feed` edge function reads it with a service account and returns only names, set lengths and times |
| Scheduled jobs (pg_cron in rickshaw-open-mic) | `rickshaw-weekly-signup-reset` (every 30 min, acts after Fri 9:40 PM), `sync-verified-signups` (every minute, copies verified requests to the sheet), `notify-selected-comics` (every 2 min; **kept switched off**, the host emails selections by hand) |
| Edge functions and their migrations | The separate StageTime repo (`slotted-killer`), not this one |

The block's settings (in the app's page JSON) include `supabase_url`, `anon_key` (public), `time_zone`, open/close weekday and
minute, and `lineup_url`. **The show-day lineup stays off until `lineup_url` is set on the live block.**

## Testing

- A local-only preview shows every show-day screen with a made-up comic:
  `http://localhost:3100/signup?preview=selected` (also `not-selected`, `no-request`, `pending`, `closed-night`, `signed-out`).
  It is compiled out of production builds.
- On a phone on the same Wi-Fi: `npm run dev:phone`, then open `http://{Mac IP}:3101/signup?preview=selected`.
- The manual test plan ("StageTime PNW · Open-mic sign-up - Pass 1.0") is on the `preview-links` branch:
  `docs/stagetime-regression-tests.csv` and `docs/stagetime-regression-report.html`.

## Wording rules

Say "selections", never "picks". There is no standby list. Comics who are not selected get no email; the page tells them.
