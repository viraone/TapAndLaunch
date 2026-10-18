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

The **Profile** tab (stage name, Instagram, email, and the Sign Out button) is the same block type with `"view": "profile"`
in its settings (`src/components/pwa-runtime/OpenMicProfileRuntime.tsx`). The Sign-Up page's "Signed in as" row has no
Sign Out button. `docs/stagetime-profile-tab.sql` added the Profile page and its tab to the live app on 2026-10-18; the
Sign-Up & Lineup tab is still added at launch.

Since 2026-10-18 (`docs/stagetime-signup-home.sql`) **Sign-Up is the home page** and the tab bar is just Sign-Up & Lineup
and Profile; the open mic list (Home) and Submit Your Open Mic left the bar (the list lives on stagetimepnw.com; their
pages still exist). `/signup` forwards to `/`. The test sign-out link is now `/?signout` (a bare `?signout` is dropped by
the forward; `?signout=1` survives it).

**Hosts tab** (2026-10-18): a group chat for the show's three hosts, text and photos, no alerts. Same block type
with `"view": "hosts"` (`src/components/pwa-runtime/OpenMicHostsRuntime.tsx`), added by `docs/stagetime-hosts-tab.sql`.
Data lives in rickshaw-open-mic (slotted-killer migration `20261018000000_host_chat.sql`): `host_chat_members` (email
and shown name: Viradeth, Nick, Noah; to add a host, insert a row), `host_messages` (members only, author set by a
trigger), private bucket `host-chat`, realtime on. The tab carries `show_if: "openmic-hosts"`: the bar shows it only
once the StageTime screens have asked `is_host_chat_member()` for the signed-in person (`src/lib/pwa/nav-flags.ts`,
`src/lib/openmic/host-chat.ts`); everyone else sees two tabs. The page itself tells a non-host it is hosts only.
For hosts the first tab reads **Home** (`label_if` on the Sign-Up tab: `{"flag": "openmic-hosts", "label": "Home"}`,
`docs/stagetime-host-home-label.sql`); everyone else sees Sign-Up & Lineup. The Sign-Up screen for a host also has a
**Messages** card under "Signed in as" (`OpenMicHostInbox.tsx`): "0 new" when nothing is waiting, otherwise the
comedian threads with unread messages (from `comedian_threads()`) and new hosts-chat messages. The hosts chat has no read
marks in the database, so "new" there is counted from what that phone last showed (`localStorage`,
`host-chat-seen:<user id>` in `src/lib/openmic/host-chat.ts`). Previews: `/?preview=host` and `/?preview=host-empty`.
The builder API's tab schema (`src/app/api/apps/[appId]/route.ts`) now keeps `show_if` and `label_if`; before, a Save
settings in the builder would have dropped them.

**Message the Hosts tab** (2026-10-18): a signed-in comedian's private line to the hosts (running late, "can I go
later?"). Block view `"messages"` (`OpenMicMessagesRuntime.tsx`), added by `docs/stagetime-message-hosts-tab.sql`; its
tab carries `show_if: "openmic-comic"` (any signed-in non-host). One thread per comedian in `comedian_messages`
(rickshaw-open-mic, migrations `20261018010000` and `20261018020000`): a comedian reads and posts only their own
thread, hosts every thread; the author is set by a trigger. The hosts read and answer in the **Hosts tab**, which now
has two parts: "Hosts chat" and "Comedians" (an inbox from `comedian_threads()`, with per-host unread counts kept in
`comedian_thread_reads`). New comedian messages email all hosts: the `notify-hosts` function runs every minute
(cron `notify-hosts-of-comedian-messages`, same secret as the signup sync) and sets `hosts_notified_at`;
`{"test_to": "you@example.com"}` sends a sample. Photos: private bucket `comedian-chat`, a folder per comedian. The
thread screen is shared code: `OpenMicChatThread.tsx`.

A page opened from the tab bar used to stay invisible until a refresh (the fade-in observer only looked once); fixed
2026-10-18 in `src/components/pwa-runtime/Look.tsx` with a MutationObserver.

## Testing

- A local-only preview shows every show-day screen with a made-up comic:
  `http://localhost:3100/signup?preview=selected` (also `not-selected`, `no-request`, `pending`, `closed-night`, `signed-out`).
  It is compiled out of production builds.
- Profile tab preview: `/profile?preview=signed-in` and `/profile?preview=signed-out` (local only, same rule).
- On a phone on the same Wi-Fi: `npm run dev:phone`, then open `http://{Mac IP}:3101/signup?preview=selected`.
- The manual test plan ("StageTime PNW · Open-mic sign-up - Pass 1.0") is on the `preview-links` branch:
  `docs/stagetime-regression-tests.csv` and `docs/stagetime-regression-report.html`.

## Wording rules

Say "selections", never "picks". There is no standby list. Comics who are not selected get no email; the page tells them.
