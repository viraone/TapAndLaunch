# Environment variables

_Last checked: 2026-10-03 (production list read from the Vercel dashboard)._ Values are **never** written here.

- **Production** values live in Vercel: project `tap-and-launch` > Settings > Environment Variables.
- **Local** values live in `.env.local` at the repo root. It is git-ignored. Never commit it.
- Anything starting with `NEXT_PUBLIC_` is **built into the browser code** at build time. After changing one in Vercel,
  redeploy **without the build cache** or the old value stays in the site.
- Other values are read at request time; a normal redeploy picks them up.

| Name | Used for | Secret? | Production (2026-10-03) | Without it |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project address | No | Set | App cannot start |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key (limited by row-level security) | No (public by design) | Set | App cannot start |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key that bypasses row-level security (published-app writes, webhooks, admin) | **Yes** | Set | Orders, members, forms, webhooks fail |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `tapandlaunch.com` (`localhost:3100` locally). Decides which host names are tenant apps | No | Set | Tenant apps do not resolve |
| `MEMBER_SESSION_SECRET` | Signs app-member session cookies | **Yes** | Set | Members cannot stay signed in |
| `GOOGLE_MAPS_API_KEY` | Google Places for the Gas and Food blocks | **Yes** | Set | Those blocks fall back or show nothing |
| `STRIPE_SECRET_KEY` | Stripe API. `sk_test_` = sandbox, `sk_live_` = real money | **Yes** | Set (**sandbox key**) | Payments card hidden; orders stay "request to buy" |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures (`whsec_`). Belongs to one webhook endpoint in one mode | **Yes** | Set (sandbox webhook) | Webhook answers 503; card orders are still confirmed when the shopper returns |
| `STRIPE_APPLICATION_FEE_PERCENT` | Optional platform fee per sale (0-50). Unset = no fee | No | Not set | No fee (intended) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web push public key (browser) | No | Set (2026-10-03) | "Enable notifications" never appears |
| `VAPID_PRIVATE_KEY` | Signs web push messages | **Yes** | Set (2026-10-03) | Push cannot be sent |
| `VAPID_CONTACT` | `mailto:` contact sent to push services | No | Set (2026-10-03) | Push cannot be sent |
| `RESEND_API_KEY` | App-level email (the Email channel on the Notifications page) | **Yes** | Set (2026-10-05) | Email channel shows "not configured". Sign-in emails still work (they go through Supabase SMTP) |
| `RESEND_FROM_EMAIL` | The sending address for app-level email, e.g. `TapAndLaunch <noreply@tapandlaunch.com>`; each email shows the app's name in front of this address | No | Set (2026-10-05) | As above |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Text messages from the Notifications page | Token is **secret** | Not set | SMS channel shows "not configured" |
| `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | Connecting customers' own domains through the Vercel API | Token is **secret** | Not set | Custom domains cannot be added |
| `DEV_APP_SLUG`, `DEV_ORIGINS`, `NEXT_DIST_DIR` | Local phone preview only (`npm run dev:phone`) | No | Never | Ignored in production |
| `VERCEL_GIT_COMMIT_SHA` | Set by Vercel automatically; goes into the service worker so each deploy installs fresh | No | Automatic | Falls back to "dev" |

Supabase Edge Functions in the *rickshaw-open-mic* project have their own secrets (Google service account, sheet id, function
secret, Resend). They are set in that project's dashboard, not in Vercel. See [stagetime-signup.md](stagetime-signup.md).
