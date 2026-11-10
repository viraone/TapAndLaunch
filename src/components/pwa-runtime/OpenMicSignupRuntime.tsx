"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { Bell, Check, ChevronRight, CircleCheck, Loader2, Mail, Mic, X } from "lucide-react";
import { CLOSED_NIGHT_COPY, notSelectedCopy, reopenPhrase, showDayState, type LineupEntry, type LineupFeed, type ShowDayState } from "@/lib/openmic/selection";
import { applyRemovals, readLineupRemoved, type LineupRemoved } from "@/lib/openmic/removed";
import { formatClock } from "@/lib/format-date";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { formatShowDate, formatWeekTime, isLineupTime, isShowDay, isWindowOpen, reopenLabel, showDateFor, type WeeklyWindow } from "@/lib/openmic/window";
import { syncChatTabs } from "@/lib/openmic/host-chat";
import { isLineupPreviewer } from "@/lib/openmic/preview-emails";
import { setSignedInName } from "@/lib/openmic/signed-in-name";
import { canTapOnDeck, spotlightIndex, useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { pushUpNext } from "@/lib/openmic/spotlight-actions";
import { clockProgress, finishedLabel, finishedRecord, onDeckFor, showClock, type ShowClock } from "@/lib/openmic/show-clock";
import { resetClock, startClock, stopClock } from "@/lib/openmic/show-clock-actions";
import { formatCountdown } from "@/lib/openmic/tv-timer";
import { useSecond } from "@/lib/openmic/use-second";
import { ShowClockBar } from "./ShowClockBar";
import { estimateStartTimes, type StartLabel } from "@/lib/openmic/start-times";
import { applyComicMinutes } from "@/lib/openmic/set-minutes";
import { noHangLock } from "@/lib/supabase/no-hang-lock";
import { HostInbox, HostInboxView } from "./OpenMicHostInbox";
import { OpenMicPushOptIn } from "./OpenMicPushOptIn";

export { initialsOf } from "@/lib/openmic/signed-in-name";

/**
 * StageTime PNW's weekly showcase sign-up. Accounts and the request list live
 * in the show's own Supabase project (the one the StageTime iOS app and the
 * Google Sheet sync use), so this talks to it straight from the browser with
 * its public key. Row-level security there limits a signed-in comedian to
 * inserting and reading their own requests.
 *
 * Sign-in is an emailed 6-digit code: it works inside Instagram's in-app
 * browser, where Google sign-in is blocked and a tapped link would open a
 * different browser. The email also carries a link; `implicit` flow means a
 * link opened in another browser still signs that browser in.
 *
 * Name / Instagram / "performed before" are kept on the account
 * (user_metadata), because the request list itself is wiped every week.
 */

interface Profile {
  stage_name: string;
  instagram: string;
  performed_before: boolean | null;
}

interface RequestRow {
  id: number;
  created_at: string;
}

/** "host": a signed-in host (Viradeth, Nick, Noah) has nothing to request: just the show and who is signed in. */
type Phase = "loading" | "email" | "code" | "ready" | "requested" | "host";

const CODE_LENGTH = 6;

/** The main buttons: solid red with white text, so they read as tappable
 * even before anything is typed (the theme's light coral with dark text
 * looked disabled). */
/** Pinned show-day layout: the viewport minus the app's header bar and tab bar, as a column. */
export const PINNED_PAGE = "mx-auto flex h-[calc(100dvh-12rem)] w-full max-w-md flex-col px-4 pt-6";
// clip-path hard-clips everything painted inside to the scroller's box. iOS Safari can paint a
// scrolled-under row a few px past the scroller's top edge (above the pinned lineup header).
export const PINNED_SCROLL = "mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 [clip-path:inset(0)]";

const CTA = "bg-[#dc2626] text-white hover:bg-[#b91c1c] active:bg-[#991b1b]";

const SEATTLE_TIME_ZONE = "America/Los_Angeles";

/** The time in Seattle to the minute. Nothing renders until mounted, because the server has no "now"; the 1 s tick
 * keeps it within a second of the minute boundary, and state changes only when the text does. */
export function SeattleClock({
  wrapperClassName = "ml-auto shrink-0 text-right",
  textClassName = "text-2xl font-black tabular-nums tracking-tight",
}: {
  wrapperClassName?: string;
  textClassName?: string;
}) {
  const [time, setTime] = useState<string | null>(null);
  const last = useRef<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const next = formatClock(new Date(), SEATTLE_TIME_ZONE);
      if (next === last.current) return;
      last.current = next;
      setTime(next);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (!time) return null;
  return (
    <div className={wrapperClassName}>
      <p className={textClassName}>{time}</p>
    </div>
  );
}

/** The show, its date, and the Open/Closed pill. Shared by the page and the local preview. */
export function SignupHeader({
  config,
  showDate,
  open,
  hidePill,
  showStartTime = false,
  reopenText,
  closesAt,
}: {
  config: OpenMicSignupBlockConfig;
  showDate: string;
  open: boolean;
  hidePill: boolean;
  showStartTime?: boolean;
  reopenText: string;
  closesAt: string;
}) {
  return (
    <header>
      <div className="flex items-center gap-3.5">
        {config.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element -- tenant-provided storage URL
          <img
            src={config.logo_url}
            alt={config.venue ?? ""}
            className="h-16 w-16 shrink-0 rounded-2xl bg-white object-cover ring-1 ring-white/10"
          />
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">Next show</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{showDate}</h1>
        </div>
        {showStartTime && (
          <p className={`ml-auto shrink-0 self-end pb-1 text-right text-[13px] font-bold uppercase tracking-[0.2em] text-foreground ${hidePill ? "translate-y-[21px]" : ""}`}>Start time</p>
        )}
      </div>
      {!hidePill && (
        <div
          role="status"
          className={`mt-4 inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-2.5 text-[11px] font-semibold min-[375px]:text-xs min-[420px]:text-[13px] ${
            open ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"
          }`}
        >
          <span className="relative flex h-3 w-3">
            {open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${open ? "bg-emerald-400" : "bg-amber-400"}`} />
          </span>
          {open ? `Open - sign up closes ${closesAt}` : `Sign ups are closed - reopens ${reopenText}`}
        </div>
      )}
    </header>
  );
}

/** The request window from the block's settings. */
export function windowOf(config: OpenMicSignupBlockConfig): WeeklyWindow {
  return {
    timeZone: config.time_zone ?? "America/Los_Angeles",
    opensWeekday: config.opens_weekday ?? 5,
    opensMinutes: config.opens_minutes ?? 21 * 60 + 40,
    closesWeekday: config.closes_weekday ?? 4,
    closesMinutes: config.closes_minutes ?? 22 * 60,
    showWeekday: config.opens_weekday ?? 5,
    lineupFromWeekday: config.lineup_from_weekday,
    lineupFromMinutes: config.lineup_from_minutes,
    closedUntil: config.closed_until ? new Date(config.closed_until) : undefined,
  };
}

// Local development only: /signup?preview=selected (and friends) shows a show-day
// screen with made-up status and the real lineup. The check is a build-time constant,
// so production builds drop the preview screen entirely.
const PREVIEW_ENABLED = process.env.NODE_ENV !== "production";
const PreviewScreen = PREVIEW_ENABLED ? dynamic(() => import("./OpenMicPreview"), { ssr: false }) : null;
const noopSubscribe = () => () => {};
const readPreview = () => (PREVIEW_ENABLED ? new URLSearchParams(window.location.search).get("preview") : null);

export function OpenMicSignupRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  const preview = useSyncExternalStore(noopSubscribe, readPreview, () => null);
  if (PREVIEW_ENABLED && (preview === "host" || preview === "host-empty")) return <HostPreview config={config} empty={preview === "host-empty"} />;
  if (PreviewScreen && preview) return <PreviewScreen kind={preview} config={config} />;
  return <OpenMicSignupLive config={config} />;
}

/** Local only: /signup?preview=host (messages waiting) and ?preview=host-empty (none), with made-up data. */
function HostPreview({ config, empty }: { config: OpenMicSignupBlockConfig; empty: boolean }) {
  const window_ = windowOf(config);
  const now = useNow();
  // The real lineup from the sheet, as on the hosts' Home during lineup time.
  const client = useOpenMicClient(config);
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
      <SignupHeader config={config} showDate={formatShowDate(showDateFor(window_, now))} open={false} hidePill reopenText="" closesAt="" />
      <div className="mt-6">
        <HostInboxView
          timeZone={window_.timeZone}
          threads={
            empty
              ? []
              : [
                  { comedian_id: "a", comedian_name: "Lori Peck", last_at: ago(12), last_body: "Running about 15 min late, can I go later in the lineup?", last_has_photo: false, unread: 2 },
                  { comedian_id: "b", comedian_name: "Sam Ortiz", last_at: ago(60 * 26), last_body: null, last_has_photo: true, unread: 1 },
                ]
          }
          chat={empty ? { count: 0, names: [] } : { count: 3, names: ["Nick", "Noah"] }}
          onDismiss={() => {}}
        />
        {client && <HostLineup client={client} config={config} />}
      </div>
    </div>
  );
}

/** The show's own Supabase client. Same storage key on every page, so the Sign-Up and Profile tabs share one sign-in. */
export function useOpenMicClient(config: OpenMicSignupBlockConfig): SupabaseClient | null {
  const url = config.supabase_url ?? "";
  const key = config.anon_key ?? "";
  return useMemo<SupabaseClient | null>(() => {
    if (!url || !key) return null;
    return createClient(url, key, {
      auth: {
        storageKey: `openmic-${new URL(url).hostname.split(".")[0]}`,
        flowType: "implicit",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        // iOS Home Screen web apps never release a navigator.locks lock, even after a force-quit,
        // so getSession and verifyOtp waited forever; this lock runs calls in order in this page
        // and gives up waiting after five seconds.
        lock: noHangLock,
      },
    });
  }, [url, key]);
}

function OpenMicSignupLive({ config }: { config: OpenMicSignupBlockConfig }) {
  const client = useOpenMicClient(config);

  const window_ = windowOf(config);
  const now = useNow();
  const open = isWindowOpen(window_, now);
  const showDate = formatShowDate(showDateFor(window_, now));

  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [email, setEmail] = useState("");
  // A signed-in host's name from the hosts list (the header's corner avatar), since hosts never fill in a stage name.
  const [hostName, setHostName] = useState("");
  // While sign-ups are closed, the email box stays tucked behind a small link.
  const [showSignIn, setShowSignIn] = useState(false);

  const profile = profileOf(user);
  // A short test list sees the comics' show-day lineup screen at any time, before Friday.
  const previewer = !!config.lineup_url && isLineupPreviewer(config.lineup_preview_emails, user?.email);

  // Who is signed in lives in the app header's corner (initials circle + first name), not in a row of its own.
  const signedInName = hostName || profile.stage_name || user?.email || "";
  useEffect(() => {
    if (user && signedInName) setSignedInName({ id: user.id, name: signedInName });
  }, [user, signedInName]);

  const load = useCallback(
    async (u: User | null) => {
      setUser(u);
      if (!client || !u) {
        if (client) void syncChatTabs(client, u);
        setRequest(null);
        setPhase("email");
        return;
      }
      // Who is signed in decides the screen: hosts see no request form or request card. The same call
      // flips the Hosts / Message the Hosts tabs.
      const [{ data }, isHost] = await Promise.all([
        client
          .from("signups")
          .select("id, created_at")
          .eq("auth_user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(1),
        syncChatTabs(client, u),
      ]);
      if (isHost) {
        const { data: me } = await client
          .from("host_chat_members")
          .select("display_name")
          .eq("email", (u.email ?? "").toLowerCase())
          .maybeSingle();
        setHostName((me?.display_name as string | undefined) ?? "");
        setRequest(null);
        setPhase("host");
        return;
      }
      setHostName("");
      const row = (data?.[0] as RequestRow | undefined) ?? null;
      setRequest(row);
      setPhase(row ? "requested" : "ready");
    },
    [client]
  );

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    // `?signout` signs out on load (handy for testing); the Profile tab has the Sign Out button.
    const params = new URLSearchParams(window.location.search);
    const start = params.has("signout")
      ? client.auth.signOut().then(() => {
          params.delete("signout");
          const rest = params.toString();
          window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
          return null;
        })
      : client.auth.getSession().then(({ data }) => data.session?.user ?? null);
    void start.then((u) => {
      if (!cancelled) void load(u);
    });
    // Catches a sign-in from the emailed link (tokens in the URL hash).
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void load(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client, load]);

  // While requests are closed, the screen shows the lineup and each comic's own status. A previewer sees it at any time.
  const showDayOn = previewer || (!open && !!config.lineup_url);
  // The previewer's header, pill and pinned layout read like show day even on an ordinary day.
  const lineupTime = previewer || isLineupTime(window_, now);
  // A comic who has already requested doesn't need the deadline, and on show day (Fri 6 AM until
  // requests reopen) a signed-in comic's card already says what they need, so the Open/Closed pill
  // is left out. Also hidden while we find out who's signed in, so it doesn't flash for returning comics.
  const hidePill =
    phase === "loading" || phase === "requested" || phase === "host" || (showDayOn && lineupTime && !!user);
  // The "Start time" label sits above the lineup's start times, so it only shows while the lineup screen is up.
  const showStartTime = showDayOn && lineupTime && !!user;

  // Show day with the lineup showing: the header stays pinned and only the area below it
  // scrolls (the page itself doesn't scroll, so there's no scroll-inside-scroll).
  const pinned = showDayOn && lineupTime && !!user && (phase === "requested" || phase === "ready");

  if (!client) {
    return (
      <p className="mx-4 my-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sign-up isn&apos;t connected yet.
      </p>
    );
  }

  return (
    <div className={pinned ? PINNED_PAGE : "mx-auto w-full max-w-md px-4 pb-12 pt-8"}>
      <div className={pinned ? (showStartTime ? "shrink-0 pb-[5px]" : "shrink-0") : undefined}>
      <SignupHeader config={config} showDate={showDate} open={open} hidePill={hidePill} showStartTime={showStartTime} reopenText={reopenLabel(window_, now)} closesAt={formatWeekTime(window_.closesWeekday, window_.closesMinutes)} />

      </div>

      <div className={pinned ? PINNED_SCROLL + (showStartTime ? " [&>*:first-child]:-mt-[5px]" : "") : "mt-6"}>
        {phase === "loading" && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {phase === "email" && !open && !showSignIn && (
          <ClosedSignedOut reopenText={reopenLabel(window_, now)} note={config.closed_note} onSignIn={() => setShowSignIn(true)} />
        )}

        {phase === "email" && (open || showSignIn) && (
          <EmailStep
            client={client}
            email={email}
            setEmail={setEmail}
            open={open}
            onSent={() => setPhase("code")}
          />
        )}

        {phase === "code" && (
          <CodeStep
            client={client}
            email={email}
            onBack={() => setPhase("email")}
            onVerified={(u) => void load(u)}
          />
        )}

        {phase === "ready" && user && (
          previewer ? (
            <ShowDayScreen client={client} userId={user.id} stageName={profile.stage_name} signedIn requested={false} config={config} dateLabel={showDate} window={window_} now={now} forceLineup />
          ) : open ? (
            <RequestForm
              client={client}
              user={user}
              profile={profile}
              onRequested={(row) => {
                setRequest(row);
                setPhase("requested");
              }}
              onProfileSaved={setUser}
            />
          ) : showDayOn ? (
            <ShowDayScreen client={client} userId={user.id} stageName={profile.stage_name} signedIn requested={false} config={config} dateLabel={showDate} window={window_} now={now} />
          ) : (
            <ClosedCard name={profile.stage_name} reopenText={reopenLabel(window_, now)} note={config.closed_note} />
          )
        )}

        {phase === "host" && user && (
          <>
            <HostInbox client={client} user={user} timeZone={window_.timeZone} />
            {(config.lineup_always === true || (showDayOn && isLineupTime(window_, now))) && <HostLineup client={client} config={config} viewerEmail={user.email} hostName={hostName} />}
          </>
        )}

        {phase === "requested" && request && (showDayOn ? (
          <ShowDayScreen client={client} userId={user?.id} stageName={profile.stage_name} signedIn requested config={config} dateLabel={showDate} window={window_} now={now} forceLineup={previewer} />
        ) : (
          <RequestedCard requestId={request.id} showDate={showDate} config={config} />
        ))}

      </div>
    </div>
  );
}

/** Signed out while sign-ups are closed: say so plainly. Sign-in is only for
 * people who already requested, so it's a small link, not a form. */
export function ClosedSignedOut({ reopenText, note, onSignIn }: { reopenText: string; note?: string; onSignIn: () => void }) {
  return (
    <div className="rounded-2xl border bg-muted/60 p-6">
      <h2 className="text-2xl font-extrabold leading-tight">{note ? "Sign ups are closed right now" : "Sign ups for this Friday are closed"}</h2>
      <p className="mt-3 text-xl font-semibold leading-snug text-foreground">{note ?? `They will reopen ${reopenText}.`}</p>
      <p className="mt-5 text-xl font-bold leading-snug text-foreground">Did you already request a spot for this week?</p>
      <button
        type="button"
        onClick={onSignIn}
        className="mt-4 flex h-14 w-full items-center justify-center gap-1.5 rounded-xl bg-primary/15 px-4 text-lg font-bold text-primary transition hover:bg-primary/25 active:scale-[0.99]"
      >
        Sign in to see your status
        <ChevronRight className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}

function EmailStep({
  client,
  email,
  setEmail,
  open,
  onSent,
}: {
  client: SupabaseClient;
  email: string;
  setEmail: (v: string) => void;
  open: boolean;
  onSent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await sendCode(client, email);
    setBusy(false);
    if (error) setError(error);
    else onSent();
  }

  return (
    <form onSubmit={send} className="rounded-2xl border bg-muted/60 p-5">
      <h2 className="text-lg font-bold">{open ? "Request your spot" : "Sign in to see your status"}</h2>
      <p className="mt-1.5 text-lg leading-snug text-muted-foreground">
        Enter your email. We&apos;ll send a 6-digit code — no password needed.
      </p>
      <label htmlFor="openmic-email" className="mt-4 block text-sm font-medium">
        Email
      </label>
      <input
        id="openmic-email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value.trim());
          setInvalid(false);
        }}
        onInvalid={() => setInvalid(true)}
        aria-invalid={invalid}
        placeholder="you@example.com"
        className={`mt-1.5 h-14 w-full rounded-xl border bg-background px-4 text-lg outline-none focus:border-primary ${
          invalid ? "border-red-500 ring-2 ring-red-500/30" : ""
        }`}
      />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className={`mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl ${CTA} text-lg font-bold disabled:opacity-60`}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
        Send my code
      </button>
      {open && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <CircleCheck className="h-6 w-6 shrink-0 text-emerald-400" aria-hidden="true" />
          <p className="text-lg font-bold leading-snug">First time or returning, please enter in your email.</p>
        </div>
      )}
    </form>
  );
}

function CodeStep({
  client,
  email,
  onBack,
  onVerified,
}: {
  client: SupabaseClient;
  email: string;
  onBack: () => void;
  onVerified: (user: User) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  // A rejected code behaves like a wrong iPhone passcode: the box shakes, turns red and empties.
  const [wrong, setWrong] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(token: string) {
    setBusy(true);
    setError(null);
    const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error || !data.user) {
      setError(friendlyAuthError(error?.message));
      setCode("");
      if (isBadCode(error?.message)) {
        setWrong(true);
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          codeInput.current?.animate(
            [
              { transform: "translateX(0)" },
              { transform: "translateX(-12px)" },
              { transform: "translateX(10px)" },
              { transform: "translateX(-8px)" },
              { transform: "translateX(6px)" },
              { transform: "translateX(-3px)" },
              { transform: "translateX(0)" },
            ],
            { duration: 420, easing: "ease-in-out" }
          );
        }
      }
      codeInput.current?.focus();
      return;
    }
    onVerified(data.user);
  }

  async function resend() {
    setError(null);
    const { error } = await sendCode(client, email);
    if (error) setError(error);
    else {
      setResent(true);
      setCooldown(60);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === CODE_LENGTH) void verify(code);
      }}
      className="rounded-2xl border bg-muted/60 p-5"
    >
      <h2 className="text-lg font-bold">Check your email</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. It works for 1 hour —
        check spam if you don&apos;t see it.
      </p>
      <input
        ref={codeInput}
        aria-label="6-digit code"
        aria-invalid={wrong}
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        value={code}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
          setCode(next);
          setWrong(false);
          if (next.length === CODE_LENGTH && !busy) void verify(next);
        }}
        placeholder="••••••"
        className={
          "mt-4 h-16 w-full rounded-xl border bg-background text-center font-mono text-3xl tracking-[0.5em] outline-none " +
          (wrong ? "border-red-500 ring-2 ring-red-500/30" : "focus:border-primary")
        }
      />
      {wrong ? (
        <div role="alert" className="mt-3 text-center">
          <p className="text-[22px] font-bold leading-tight text-red-400">Wrong code. Try again.</p>
          <p className="mt-1 text-sm text-muted-foreground">Use the newest email, or send a new code.</p>
        </div>
      ) : (
        error && <p className="mt-3 text-sm text-red-400">{error}</p>
      )}
      {resent && !error && <p className="mt-3 text-sm text-emerald-300">New code sent.</p>}
      <button
        type="submit"
        disabled={busy || code.length !== CODE_LENGTH}
        className={`mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl ${CTA} text-lg font-bold disabled:opacity-60`}
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}
        Continue
      </button>
      <div className="mt-2 flex justify-between text-[17px] text-foreground dark:text-white">
        <button type="button" onClick={onBack} className="-ml-1 flex min-h-11 items-center px-1 underline-offset-2 hover:underline">
          Change email
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="-mr-1 flex min-h-11 items-center px-1 underline-offset-2 hover:underline disabled:no-underline"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}

/** One screen, as in the mockup: details (pre-filled from the account after
 * the first time), both agreements and the button. Changed details are saved
 * back to the account in the same tap. */
function RequestForm({
  client,
  user,
  profile,
  onRequested,
  onProfileSaved,
}: {
  client: SupabaseClient;
  user: User;
  profile: Profile;
  onRequested: (row: RequestRow) => void;
  onProfileSaved: (u: User) => void;
}) {
  const [stageName, setStageName] = useState(profile.stage_name);
  const [instagram, setInstagram] = useState(profile.instagram);
  const [performed, setPerformed] = useState<boolean | null>(profile.performed_before);
  const [noShow, setNoShow] = useState(false);
  const [guarantee, setGuarantee] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = stageName.trim() !== "" && performed !== null && noShow && guarantee;

  async function request(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    const next: Profile = {
      stage_name: stageName.trim(),
      instagram: normalizeInstagram(instagram),
      performed_before: performed,
    };
    if (
      next.stage_name !== profile.stage_name ||
      next.instagram !== profile.instagram ||
      next.performed_before !== profile.performed_before
    ) {
      // Not fatal: the request below still carries the details. The updated user goes straight up so the
      // account row shows the stage name now, not after the next sign-in (found by automation 2026-10-06).
      const { data: updated } = await client.auth.updateUser({ data: next });
      if (updated?.user) onProfileSaved(updated.user);
    }

    const email = (user.email ?? "").toLowerCase();
    // A request made by the same email elsewhere (the iOS app, or the old
    // stagetimepnw.com form) counts too.
    const { data: already } = await client.rpc("has_active_verified_signup", { p_email: email });
    if (already === true) {
      const { data } = await client
        .from("signups")
        .select("id, created_at")
        .eq("auth_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      setBusy(false);
      onRequested((data?.[0] as RequestRow | undefined) ?? { id: 0, created_at: new Date().toISOString() });
      return;
    }
    const { data, error } = await client
      .from("signups")
      .insert({
        name: next.stage_name,
        email,
        phone: "N/A",
        instagram: next.instagram || "@n/a",
        performed_before: next.performed_before ?? false,
        no_show_agreement: true,
        guarantee_agreement: true,
        slot_type: "First Available",
        is_verified: true,
        auth_user_id: user.id,
      })
      .select("id, created_at")
      .single();
    setBusy(false);
    if (error || !data) setError("Couldn't send your request. Try again in a moment.");
    else onRequested(data as RequestRow);
  }

  return (
    <form onSubmit={request} className="space-y-5 rounded-2xl border bg-muted/60 p-5">
      <div>
        <label htmlFor="openmic-name" className="block text-sm font-semibold">
          Stage name <span className="text-primary">*</span>
        </label>
        <input
          id="openmic-name"
          required
          maxLength={100}
          autoComplete="name"
          value={stageName}
          onChange={(e) => setStageName(e.target.value)}
          placeholder="Your name"
          className="mt-1.5 h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:border-primary"
        />
      </div>
      <div>
        <label htmlFor="openmic-ig" className="block text-sm font-semibold">
          Instagram <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="openmic-ig"
          maxLength={100}
          autoComplete="off"
          autoCapitalize="none"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="@handle"
          className="mt-1.5 h-12 w-full rounded-xl border bg-background px-4 text-base outline-none focus:border-primary"
        />
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">
          Performed at this show before? <span className="text-primary">*</span>
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={performed === v}
              onClick={() => setPerformed(v)}
              className={`flex h-12 items-center gap-3 rounded-xl border px-4 text-base font-medium ${
                performed === v ? "border-primary bg-primary/10" : "bg-background"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  performed === v ? "border-primary" : "border-muted-foreground/60"
                }`}
              >
                {performed === v && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </span>
              {v ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-3">
        <Agreement checked={noShow} onChange={setNoShow}>
          If I miss my spot without telling the host, it may affect future bookings.
        </Agreement>
        <Agreement checked={guarantee} onChange={setGuarantee}>
          A request doesn&apos;t guarantee a spot. If you&apos;re selected, we&apos;ll email you on Thursday. If you don&apos;t
          hear from us, check this page Friday morning.
        </Agreement>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !ready}
        className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl ${CTA} text-lg font-bold disabled:opacity-50`}
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}
        Request my spot
      </button>
      {!ready && !busy && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">
          {stageName.trim() === "" || performed === null ? "Fill in the starred fields" : "Tick both boxes to continue"}
        </p>
      )}
    </form>
  );
}

function RequestedCard({
  requestId,
  showDate,
  config,
}: {
  requestId: number;
  showDate: string;
  config: OpenMicSignupBlockConfig;
}) {
  // Celebrate once per request: the first time this card shows after the request was made. Later visits get the
  // glow only. Per-viewer convenience, so blocked storage just means it may play again.
  const celebrateKey = `stagetime-request-celebrated-${requestId}`;
  const [celebrate] = useState(() => !readFlag(celebrateKey));
  useEffect(() => {
    writeFlag(celebrateKey);
  }, [celebrateKey]);

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
      <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
        <span aria-hidden className="request-check-glow absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        {celebrate && <span aria-hidden className="request-check-ring absolute inset-0 rounded-full border-2 border-emerald-400" />}
        <div
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_24px_rgba(16,185,129,0.45)] ${celebrate ? "request-check-pop" : ""}`}
        >
          <Check className="h-7 w-7" strokeWidth={3} />
        </div>
      </div>
      <h2 className="mt-4 text-xl font-bold">
        You&apos;re on the <span className="text-emerald-400">Request list</span>
      </h2>
      <div className="mt-5 rounded-xl bg-foreground/[0.04] p-4 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">What happens next</p>
        <ol className="mt-4 space-y-5 text-[15px]">
          <li className="relative pl-12">
            <span aria-hidden className="absolute left-4 top-9 -bottom-5 w-px bg-primary/30" />
            <span aria-hidden className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
              <Bell className="h-4 w-4" />
            </span>
            <span className="font-semibold text-primary">Thursday</span>
            <p className="mt-0.5">If you&apos;re selected, we&apos;ll notify you.</p>
          </li>
          <li className="relative pl-12">
            <span aria-hidden className="absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
              <Mic className="h-4 w-4" />
            </span>
            <span className="font-semibold text-primary">{showDate.split(",")[0]}</span>
            <p className="mt-0.5">
              {config.show_name ?? "The show"}
              {config.venue ? ` at ${config.venue}` : ""}
              {config.show_time ? `, ${config.show_time.replace(/^Fridays\s*/i, "")}` : ""}. Not selected? You can request
              again next week.
            </p>
          </li>
        </ol>
      </div>
    </div>
  );
}

/** Signed in, no request, requests closed, lineup off: when they open again, in the pill's words. */
function ClosedCard({ name, reopenText, note }: { name: string; reopenText: string; note?: string }) {
  return (
    <div className="rounded-2xl border bg-muted/60 p-6 text-center">
      <h2 className="text-lg font-bold">Requests are closed for this week</h2>
      <p className="mt-2 text-[15px] text-foreground/85">
        {note ?? `${name ? `${name.split(/\s+/)[0]}, requests` : "Requests"} open again ${reopenText}.`}
      </p>
    </div>
  );
}

function Agreement({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm leading-6">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="text-muted-foreground">{children}</span>
    </label>
  );
}

export function profileOf(user: User | null): Profile {
  const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return {
    stage_name: typeof m.stage_name === "string" ? m.stage_name : "",
    instagram: typeof m.instagram === "string" ? m.instagram : "",
    performed_before: typeof m.performed_before === "boolean" ? m.performed_before : null,
  };
}

export function normalizeInstagram(v: string): string {
  const h = v
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "");
  return h ? `@${h}` : "";
}

async function sendCode(client: SupabaseClient, email: string): Promise<{ error: string | null }> {
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + window.location.pathname },
  });
  return { error: error ? friendlyAuthError(error.message) : null };
}

/** The code was wrong or too old (as opposed to rate limits or network trouble). */
function isBadCode(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return m.includes("expired") || m.includes("invalid");
}

function friendlyAuthError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (isBadCode(message)) return "That code didn't work. Use the newest email, or send a new code.";
  if (m.includes("rate limit")) return "Too many emails right now. Try again in a few minutes.";
  const wait = m.match(/after (\d+) seconds?/);
  if (wait) return `Wait ${wait[1]} seconds, then try again.`;
  if (m.includes("email")) return "Check that your email address is right.";
  return "Something went wrong. Try again.";
}

/** Re-renders every 30 s so the open/closed state flips on time. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** The hosts' hidden names for tonight; any trouble reads as "nothing removed" so the lineup still shows. */
async function fetchRemoved(): Promise<LineupRemoved | null> {
  try {
    const res = await fetch("/openmic/removed", { cache: "no-store" });
    if (!res.ok) return null;
    return readLineupRemoved(await res.json());
  } catch {
    return null;
  }
}

/**
 * The lineup feed, refreshed every minute while the screen is showing, with the hosts' AI-tab removals applied.
 * Every screen (phone, hosts' home, Remote, venue board and AI tab) reads the lineup through this hook.
 */
export function useLineup(url: string | undefined, client: SupabaseClient, userId: string | undefined, enabled: boolean) {
  const [feed, setFeed] = useState<LineupFeed | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url || !enabled) return;
    let cancelled = false;
    async function load() {
      try {
        const { data } = await client.auth.getSession();
        const token = data.session?.access_token;
        const [res, removed] = await Promise.all([
          fetch(url!, { headers: token ? { authorization: `Bearer ${token}` } : {} }),
          fetchRemoved(),
        ]);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as LineupFeed;
        if (!cancelled) {
          setFeed(applyRemovals(json, removed));
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    const timer = setInterval(load, 60_000);
    // The AI tab saves a removal, then asks every open screen to reload now rather than at the next minute.
    const refresh = () => void load();
    window.addEventListener("openmic-lineup-refresh", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("openmic-lineup-refresh", refresh);
    };
  }, [url, client, userId, enabled]);
  return { feed, failed };
}

/** Loads the feed and works out which message this visitor sees. */
function ShowDayScreen({
  client,
  userId,
  stageName,
  signedIn,
  requested,
  config,
  dateLabel,
  window,
  now,
  forceLineup,
}: {
  client: SupabaseClient;
  userId: string | undefined;
  /** From the profile; the push subscription is stored under it until the lineup row gives the exact name. */
  stageName: string;
  signedIn: boolean;
  requested: boolean;
  config: OpenMicSignupBlockConfig;
  dateLabel: string;
  window: WeeklyWindow;
  now: Date;
  /** A preview account sees the lineup even outside show day. */
  forceLineup?: boolean;
}) {
  // Thursday 10 PM to Friday 6 AM nothing about selections or the lineup is shown, so nothing is fetched.
  const lineupTime = forceLineup || isLineupTime(window, now);
  const { feed: sheetFeed, failed } = useLineup(config.lineup_url, client, userId, lineupTime);
  // Every comic looking at the lineup follows the show clock, not only the selected ones.
  const { spotlight } = useSpotlight(lineupTime ? client : null);
  const feed = useMemo(() => applyComicMinutes(sheetFeed, spotlight, config.host_row === true), [sheetFeed, spotlight, config.host_row]);
  const state = showDayState({ signedIn, requested, feed, failed, lineupTime });
  // The hosts' spotlight (Remote tab): when it lands on this comic's own row, the page says so and buzzes the phone.
  // The system notification comes as a push from the server (OpenMicPushOptIn), which also reaches a closed app.
  const second = useSecond();
  const mineAt = feed?.lineup.findIndex((e) => e.mine) ?? -1;
  const showDate = ymd(showDateFor(window, now));
  // From the hosts' highlight: the row after it is on deck, so each later row can show a live estimate. Without a
  // usable spotlight every row keeps its sheet time (see start-times.ts).
  const startLabels = feed ? estimateStartTimes({ lineup: feed.lineup, spotlight, showDate, timeZone: window.timeZone, now: second }) : undefined;
  const started = !!feed && spotlightIndex(spotlight, feed.lineup, showDate) !== -1;
  const clock = feed ? showClock({ lineup: feed.lineup, spotlight, showDate, hostRow: config.host_row === true, now: second }) : null;
  const live: LiveLineup | undefined =
    feed && clock && started
      ? {
          clock,
          started,
          performingIndex: clock.kind === "running" ? clock.index : -1,
          onDeckIndex: onDeckFor(clock, feed.lineup.length, config.host_row === true),
          over: clock.kind === "running" && clock.remainingMs < 0,
          livePill: clock.kind === "running" ? formatCountdown(clock.remainingMs) : undefined,
          progress: clockProgress(clock),
          finished: feed.lineup.map((entry, i) => finishedLabel(finishedRecord(spotlight?.sets, i, entry.name), entry.set_length)),
        }
      : undefined;
  // On deck on the hosts' show clock: the open app buzzes at the same moment the server's up-next push goes out.
  const upNext = state === "selected" && mineAt >= 0 && live?.onDeckIndex === mineAt;
  useEffect(() => {
    if (!upNext) return;
    try {
      navigator.vibrate?.([250, 120, 250]);
    } catch {
      // A browser without vibration: the card on the page is enough.
    }
  }, [upNext]);
  // Offered to a comic who is on (or may still be put on) tonight's lineup; the stored name follows the lineup row.
  const pushName = mineAt >= 0 ? feed!.lineup[mineAt]!.name : stageName;
  const optIn = lineupTime && (state === "selected" || state === "selections-pending") ? <OpenMicPushOptIn client={client} name={pushName} hideWhenOn /> : undefined;
  return (
    <ShowDay
      state={state}
      feed={feed}
      failed={failed}
      config={config}
      today={isShowDay(window, now)}
      lineupTime={lineupTime}
      upNext={upNext}
      startLabels={startLabels}
      live={live}
      optIn={optIn}
      dismissKey={`openmic-in-dismissed:${userId ?? "anon"}:${dateLabel}`}
    />
  );
}

/** What the show clock adds to the comics' lineup once the show has started. */
export type LiveLineup = { clock: ShowClock; started: boolean; performingIndex: number; onDeckIndex: number; over: boolean; livePill?: string; progress?: number; finished: (string | null)[] };

/** Show day (Thu 10 PM to Fri 9:40 PM): the comic's own status, then the lineup. */
export function ShowDay({
  state,
  feed,
  failed,
  config,
  today,
  lineupTime,
  startLabels,
  live,
  optIn,
  dismissKey,
}: {
  state: ShowDayState;
  feed: LineupFeed | null;
  failed: boolean;
  config: OpenMicSignupBlockConfig;
  today: boolean;
  lineupTime: boolean;
  /** The hosts have highlighted this comic on the lineup screen: they're up next. */
  upNext?: boolean;
  /** Live start times from the spotlight, one per lineup row (start-times.ts). */
  startLabels?: StartLabel[];
  /** The show clock once the show has started: highlights, countdown and finished rows. */
  live?: LiveLineup;
  /** The "Get buzzed when you're up next" card (OpenMicPushOptIn), under the night's status card. */
  optIn?: ReactNode;
  /** Where the "You're in!" card remembers it was dismissed (per person, per show day). */
  dismissKey: string;
}) {
  const [dismissed, setDismissed] = useState(() => readFlag(dismissKey));
  function dismiss() {
    setDismissed(true);
    writeFlag(dismissKey);
  }
  if (lineupTime && !feed && !failed) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading the lineup">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const notSelected = notSelectedCopy(today);
  // This week's own closed wording (closed_note), in place of the usual "requests open right after the show".
  const note = config.closed_note;
  const mine = feed?.me;
  // 1-based place in the running order, for the card; 0 when the comic's row isn't in the list.
  const spot = (feed?.lineup.findIndex((e) => e.mine) ?? -1) + 1;
  // The card shows the same live estimate as this comic's lineup row, falling back to the sheet's time.
  const myStart = spot > 0 ? startLabels?.[spot - 1]?.text : undefined;

  return (
    <div className="space-y-4">
      {state === "closed-night" && (
        <div className="rounded-2xl border bg-muted/60 p-6">
          <h2 className="text-xl font-bold">{CLOSED_NIGHT_COPY.title}</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{CLOSED_NIGHT_COPY.body}</p>
        </div>
      )}

      {state === "selected" && mine && !dismissed && (
        // The night's good news, dressed for it: an emerald glow behind the check, the spot and set length in two
        // tiles under the headline, so a comic never has to find their own row to know when they're on.
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(16,185,129,0.22),transparent_62%)] p-6 pb-5 text-center shadow-[0_24px_60px_-32px_rgba(16,185,129,0.7)]">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            title="Dismiss"
            className="group absolute right-1 top-1 z-10 grid h-12 w-12 place-items-center"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground/15 text-foreground/80 transition group-hover:bg-foreground/25 group-active:bg-foreground/30">
              <X className="h-5 w-5" strokeWidth={2.75} />
            </span>
          </button>
          <div className="relative mx-auto h-16 w-16">
            <span aria-hidden className="absolute -inset-3 rounded-full bg-emerald-400/25 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_10px_28px_rgba(16,185,129,0.45)] ring-4 ring-emerald-500/20">
              <Check className="h-8 w-8" strokeWidth={3} />
            </div>
          </div>
          <h2 className="mt-4 text-[32px] font-black leading-none tracking-tight">You&apos;re in!</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {config.show_name ?? "The show"}
            {config.venue ? ` at ${config.venue}` : ""}
            {spot > 0 ? ` · spot ${spot}` : ""}
          </p>
          {(mine.start_time || mine.set_length) && (
            <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-2xl bg-background/50 p-1.5 ring-1 ring-white/10">
              <div className="rounded-xl bg-muted px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">You&apos;re on</p>
                <p className="mt-0.5 text-[22px] font-black tabular-nums leading-tight text-primary">{myStart || mine.start_time || "—"}</p>
              </div>
              <div className="rounded-xl bg-muted px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Your set</p>
                <p className="mt-0.5 text-[22px] font-black tabular-nums leading-tight text-foreground">{mine.set_length || "—"}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {state === "not-selected" && (
        <div className="rounded-2xl border bg-muted/60 p-6">
          <h2 className="text-xl font-bold">{notSelected.title}</h2>
          <p className="mt-2 text-base leading-relaxed text-foreground/85">
            {note ? `${notSelected.body.split(" Requests open ")[0]} ${note}` : notSelected.body}
          </p>
        </div>
      )}

      {state === "selections-pending" && (
        <div className="rounded-2xl border bg-muted/60 p-6">
          <h2 className="text-xl font-bold">We&apos;re putting the lineup together</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            If you&apos;re selected, we&apos;ll email you and your spot will show up here. Check back soon.
          </p>
        </div>
      )}

      {state === "no-request" && (
        <div className="rounded-2xl border bg-muted/60 p-6">
          <h2 className="text-xl font-bold">Requests are closed for this week</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{note ?? `Requests open ${reopenPhrase(today)}.`}</p>
        </div>
      )}

      {state === "unavailable" && (
        <div className="rounded-2xl border bg-muted/60 p-6">
          <h2 className="text-xl font-bold">We couldn&apos;t load the lineup</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">Try again in a minute.</p>
        </div>
      )}

      {optIn}

      {lineupTime && config.show_lineup !== false && feed?.posted && feed.lineup.length > 0 && (
        <>
          <LineupList
            feed={feed}
            startLabels={startLabels}
            performingIndex={live?.performingIndex}
            onDeckIndex={live ? live.onDeckIndex : config.host_row === true && feed.lineup.length > 1 ? 1 : undefined}
            over={live?.over}
            livePill={live?.livePill}
            progress={live?.progress}
            finished={live?.finished}
            hostRow={config.host_row === true}
          />
        </>
      )}
    </div>
  );
}

/** The lineup as an inset grouped list (the comics' show-day screen and the hosts' Home): place in the order, name,
 * set length and start time. The asking comic's own row (entry.mine) carries the colour and one clean outline. With the
 * show clock: the performing row gets the primary ring, a LIVE tag and the live countdown in its pill (all red
 * past the set length), the on-deck row a gold ring and an ON DECK tag, and a finished row is dimmed with how the
 * comic did in the time column. The list scrolls the performing row into view when it changes. */
export function LineupList({
  feed,
  startLabels,
  onTap,
  onDeckIndex,
  performingIndex,
  over,
  livePill,
  progress,
  finished,
  size,
  hostRow,
}: {
  feed: LineupFeed;
  startLabels?: StartLabel[];
  onTap?: (entry: LineupEntry, index: number) => void;
  /** The comic who is next (gold ring, ON DECK). */
  onDeckIndex?: number;
  /** The comic on stage (primary ring, LIVE, live pill). */
  performingIndex?: number;
  /** The performing comic is past their set length: everything about that row turns red. */
  over?: boolean;
  /** The live countdown text for the performing row's pill, e.g. "2:41" or "+0:15". */
  livePill?: string;
  /** How much of the performing comic's set has gone, 0 to 100, for the progress line. */
  progress?: number;
  /** Per row, how a finished comic did ("2:50", "+0:40") or null; a non-null entry dims the row. */
  finished?: (string | null)[];
  size?: "default" | "board";
  /** The first row is always the hosts: it carries a HOSTS tag (unless it is performing or on deck). */
  hostRow?: boolean;
}) {
  const big = size === "board";
  useEffect(() => {
    if (performingIndex === undefined || performingIndex < 0) return;
    document.getElementById(`openmic-row-${performingIndex}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [performingIndex]);
  const tag = "absolute -top-2.5 left-4 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-[0.16em]";
  return (
    <section aria-label="Lineup">
      {/* Each row is its own small card with its place in the order. The outline is drawn inside the row (ring-inset):
          the scroller is exactly as wide as the rows and clips anything outside them. Rows slide in one after
          another (openmic-row, globals.css). */}
      <ol className="mt-4 space-y-3">
        {feed.lineup.map((entry, i) => {
          const performing = i === performingIndex;
          const onDeck = !performing && i === onDeckIndex;
          const result = performing ? null : (finished?.[i] ?? null);
          const accent = performing || onDeck;
          const fill = performing
            ? over
              ? "bg-red-950/50"
              : "bg-[color-mix(in_oklab,var(--primary)_16%,var(--muted))]"
            : onDeck
              ? "bg-white/[0.04]"
              : "bg-muted";
          const shadow = performing
            ? over
              ? "inset 0 0 0 2px #ef4444, inset 0 0 36px rgba(239, 68, 68, 0.36)"
              : "inset 0 0 0 2px var(--primary), inset 0 0 36px color-mix(in oklab, var(--primary) 38%, transparent)"
            : onDeck
              ? "inset 0 0 0 1.5px #fbbf24, inset 0 0 22px rgba(251, 191, 36, 0.22)"
              : "inset 0 0 0 1px rgba(255, 255, 255, 0.05)";
          return (
            <li
              key={`${entry.name}-${i}`}
              id={`openmic-row-${i}`}
              aria-current={entry.mine ? "true" : undefined}
              style={{ animationDelay: `${Math.min(i, 14) * 35}ms`, boxShadow: shadow }}
              role={onTap ? "button" : undefined}
              tabIndex={onTap ? 0 : undefined}
              onClick={onTap ? () => onTap(entry, i) : undefined}
              onKeyDown={
                onTap
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onTap(entry, i);
                      }
                    }
                  : undefined
              }
              className={
                "openmic-row relative flex min-h-[3.75rem] items-center gap-3 rounded-[1.15rem] py-3 pl-4 pr-3.5 transition-[background-color,box-shadow,opacity] duration-500 ease-out motion-reduce:transition-none " +
                (big ? "md:gap-6 md:py-6 " : "") +
                fill +
                (result ? " opacity-40" : "") +
                (onTap ? " cursor-pointer active:opacity-80" : "")
              }
            >
              {performing && (
                <span className={`${tag} ${over ? "bg-red-500 text-white" : "bg-primary text-primary-foreground"}`}>
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                  </span>
                  {over ? "Time" : "Live"}
                </span>
              )}
              {onDeck && <span className={`${tag} bg-[#fbbf24] text-black`}>On deck</span>}
              {hostRow === true && i === 0 && !performing && !onDeck && <span className={`${tag} min-w-[4.85rem] justify-center bg-white text-black`}>Hosts</span>}
              <span className={"w-6 shrink-0 text-[12px] font-bold tabular-nums " + (big ? "md:w-10 md:text-2xl " : "") + (performing ? "text-primary" : onDeck ? "text-[#fbbf24]" : "text-muted-foreground/60")}>{String(i + 1).padStart(2, "0")}</span>
              <span className={"min-w-0 flex-1 break-words text-[17px] leading-snug tracking-tight text-foreground dark:text-white " + (big ? "md:text-4xl 2xl:text-5xl md:font-bold " : "") + (accent ? "font-bold" : "font-medium")}>
                {entry.name}
                {entry.mine && (
                  <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-primary px-2 py-0.5 align-middle text-[11px] font-black uppercase leading-none tracking-wide text-primary-foreground">
                    You
                  </span>
                )}
              </span>
              <span
                className={
                  "shrink-0 rounded-full tabular-nums ring-1 " +
                  (performing && livePill
                    ? over
                      ? "bg-red-500 px-3 py-1 text-[15px] font-bold text-white ring-red-400"
                      : "bg-primary px-3 py-1 text-[15px] font-bold text-primary-foreground ring-primary"
                    : "bg-background/60 px-2.5 py-1 text-[13px] font-semibold text-muted-foreground ring-white/10") +
                  (big ? " md:px-6 md:py-2 md:text-3xl 2xl:text-4xl md:font-bold md:text-white md:bg-white/10 md:ring-white/25" : "")
                }
              >
                {performing && livePill ? livePill : entry.set_length}
              </span>
              <span
                className={
                  "flex w-24 shrink-0 items-center justify-end gap-1.5 whitespace-nowrap text-right text-[17px] font-bold tabular-nums " +
                  (result ? "text-muted-foreground" : performing ? "text-primary" : onDeck ? "text-[#fbbf24]" : "text-foreground/75") +
                  (big ? " md:w-44 md:text-4xl 2xl:w-56 2xl:text-5xl" : "")
                }
              >
                {result && <Check className={"h-3.5 w-3.5 shrink-0 " + (big ? "md:h-6 md:w-6" : "")} aria-hidden="true" />}
                {result ? null : (
                  <span className="flex flex-col items-end leading-none">
                    {!performing && !(hostRow && i === 0) && <span className={"mb-1 text-[9px] font-black uppercase tracking-[0.2em] opacity-70 " + (big ? "md:text-sm" : "")}>Est.</span>}
                    <span>{(startLabels?.[i]?.text ?? entry.start_time).replace(/^~/, "")}</span>
                  </span>
                )}
              </span>
              {performing && progress !== undefined && (
                <span aria-hidden="true" className={"pointer-events-none absolute inset-x-4 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-white/10 " + (big ? "md:bottom-3 md:h-[5px]" : "")}>
                  <span
                    className={"block h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none " + (over ? "bg-red-500" : "bg-primary")}
                    style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The hosts' Home: the same list the comics see, with the show clock. START puts the next comic on stage (and buzzes
 * the one after them, now on deck), STOP ends the set and records it, RESET clears the show. Only the hosts in
 * TAP_ON_DECK_EMAILS get the buttons; other hosts watch the same clock. */
function HostLineup({ client, config, viewerEmail, hostName }: { client: SupabaseClient; config: OpenMicSignupBlockConfig; viewerEmail?: string | null; hostName?: string }) {
  const { feed: sheetFeed, failed } = useLineup(config.lineup_url, client, undefined, true);
  const { spotlight } = useSpotlight(client);
  const feed = useMemo(() => applyComicMinutes(sheetFeed, spotlight, config.host_row === true), [sheetFeed, spotlight, config.host_row]);
  const now = useSecond();
  const window_ = windowOf(config);
  const showYmd = ymd(showDateFor(window_, now));
  const canControl = canTapOnDeck(viewerEmail);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const startLabels = feed
    ? estimateStartTimes({ lineup: feed.lineup, spotlight, showDate: showYmd, timeZone: window_.timeZone, now })
    : undefined;
  if (!feed && !failed) {
    return (
      <div className="flex justify-center py-8" role="status" aria-label="Loading the lineup">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!feed) {
    return (
      <div className="mt-4 rounded-2xl border bg-muted/60 p-6">
        <h2 className="text-xl font-bold">We couldn&apos;t load the lineup</h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">Try again in a minute.</p>
      </div>
    );
  }
  if (!feed.posted || feed.lineup.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border bg-muted/60 p-6">
        <h2 className="text-xl font-bold">No lineup in the sheet yet</h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">Fill in the set lengths and times and it shows up here.</p>
      </div>
    );
  }
  const hostRow = config.host_row === true;
  const clock = showClock({ lineup: feed.lineup, spotlight, showDate: showYmd, hostName, hostRow, now });
  const started = spotlightIndex(spotlight, feed.lineup, showYmd) !== -1;
  const finished = started ? feed.lineup.map((entry, i) => finishedLabel(finishedRecord(spotlight?.sets, i, entry.name), entry.set_length)) : undefined;
  const run = async (action: () => Promise<string | null>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    try {
      const problem = await action();
      setStatus(problem ? "That did not save. Check the connection and try again." : "");
      if (!problem) after?.();
    } finally {
      setBusy(false);
    }
  };
  const controls = canControl
    ? {
        busy,
        onStart: () => {
          if (clock.kind !== "idle" || clock.nextIndex === -1) return;
          const index = clock.nextIndex;
          void run(
            () => startClock(client, showYmd, feed.lineup, index),
            () => {
              // The comic after the one who just walked on is now on deck: buzz them.
              const next = feed.lineup[index + 1];
              if (next) void client.auth.getSession().then(({ data }) => pushUpNext(next.name, data.session?.access_token));
            },
          );
        },
        onStop: () => {
          if (clock.kind !== "running" || !spotlight) return;
          void run(() => stopClock(client, spotlight));
        },
        onReset: () => void run(() => resetClock(client, showYmd)),
      }
    : undefined;
  return (
    <div className="mt-4 pb-36">
      {status && (
        <p className="mb-2 text-sm font-medium text-muted-foreground" role="status">
          {status}
        </p>
      )}
      <LineupList
        feed={feed}
        startLabels={startLabels}
        performingIndex={clock.kind === "running" ? clock.index : -1}
        onDeckIndex={onDeckFor(clock, feed.lineup.length, hostRow)}
        over={clock.kind === "running" && clock.remainingMs < 0}
        livePill={clock.kind === "running" ? formatCountdown(clock.remainingMs) : undefined}
        progress={clockProgress(clock)}
        finished={finished}
        hostRow={hostRow}
      />
      <ShowClockBar clock={clock} started={started} controls={controls} />
    </div>
  );
}

// Per-viewer convenience only: if storage is blocked the card simply stays.
function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}
