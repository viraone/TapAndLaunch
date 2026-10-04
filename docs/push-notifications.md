# Push notifications

_Last checked: 2026-10-03._ Working on production since 2026-10-03 (a live send and click were confirmed).

## How it works

1. A visitor of a published app taps **Enable notifications** (top bar of the app). The browser asks for permission, then
   subscribes with our **VAPID public key** and the app saves the subscription (`POST /push/subscribe`, table
   `push_subscriptions`).
2. A builder sends a message from **Dashboard > app > Notifications** (channel "Web push", audience everyone or a tier).
   The server signs each message with the **VAPID private key** (`web-push` library, `src/lib/notifications/push.ts`) and
   hands it to the browser's push service (Google for Chrome, Mozilla for Firefox). Gone subscriptions are deleted.
3. The app's **service worker** shows the notification. Clicking it focuses a tab already on the target page, or sends an open
   tab of the app there, or opens a new tab, and records `push_opened` (`POST /push/opened`).

## Keys

`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` (see [environment-variables.md](environment-variables.md)).
Generate a pair with `npx web-push generate-vapid-keys`. **Changing the keys breaks every existing subscription**: visitors must
enable notifications again. The public key is built into the browser code, so redeploy without the build cache after setting it.

## Code

| Path | Role |
|---|---|
| `src/components/pwa-runtime/PushOptIn.tsx` | The Enable / Disable notifications link (hidden when the key is missing or permission was denied) |
| `src/app/published-apps/[appSlug]/push/` | subscribe, unsubscribe, opened |
| `src/lib/pwa/service-worker.ts` | Builds the service worker text; includes the deploy id so every deploy installs a fresh worker |
| `src/lib/pwa/notification-click.ts` | The click handler (tested with a fake worker) |
| `src/lib/notifications/push.ts`, `recipients.ts` | Sending and audience resolution |
| `src/app/api/apps/[appId]/notifications/send/route.ts` | The send API used by the dashboard |

## Testing

1. Open a published app, click **Enable notifications**, allow it.
2. In the dashboard, open that app's Notifications page and send a Web push.
3. The page shows "N sent". The notification appears in the corner of the screen.

If "sent" but nothing appears, the computer is hiding it: see [known-issues.md](known-issues.md#push-sent-but-nothing-appears).
