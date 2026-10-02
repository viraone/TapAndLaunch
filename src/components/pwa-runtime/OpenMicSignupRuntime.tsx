"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { Check, CircleCheck, Loader2, Mail, X } from "lucide-react";
import { CLOSED_NIGHT_COPY, notSelectedCopy, reopenPhrase, showDayState, type LineupFeed, type ShowDayState } from "@/lib/openmic/selection";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { formatShowDate, formatWeekTime, isLineupTime, isShowDay, isWindowOpen, reopenLabel, showDateFor, type WeeklyWindow } from "@/lib/openmic/window";

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

type Phase = "loading" | "email" | "code" | "ready" | "requested";

const CODE_LENGTH = 6;

/** The main buttons: solid red with white text, so they read as tappable
 * even before anything is typed (the theme's light coral with dark text
 * looked disabled). */
const CTA = "bg-[#dc2626] text-white hover:bg-[#b91c1c] active:bg-[#991b1b]";

export function OpenMicSignupRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  const url = config.supabase_url ?? "";
  const key = config.anon_key ?? "";

  const client = useMemo<SupabaseClient | null>(() => {
    if (!url || !key) return null;
    return createClient(url, key, {
      auth: {
        storageKey: `openmic-${new URL(url).hostname.split(".")[0]}`,
        flowType: "implicit",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }, [url, key]);

  const window_: WeeklyWindow = {
    timeZone: config.time_zone ?? "America/Los_Angeles",
    opensWeekday: config.opens_weekday ?? 5,
    opensMinutes: config.opens_minutes ?? 21 * 60 + 40,
    closesWeekday: config.closes_weekday ?? 4,
    closesMinutes: config.closes_minutes ?? 22 * 60,
    showWeekday: config.opens_weekday ?? 5,
  };
  const now = useNow();
  const open = isWindowOpen(window_, now);
  const showDate = formatShowDate(showDateFor(window_, now));

  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [email, setEmail] = useState("");

  const profile = profileOf(user);

  // The React Compiler flags this memo (it only opts the component out of its own
  // optimizing); the callback itself is correct, so the rule is skipped here.
  const load = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    async (u: User | null) => {
      setUser(u);
      if (!client || !u) {
        setRequest(null);
        setPhase("email");
        return;
      }
      const { data } = await client
        .from("signups")
        .select("id, created_at")
        .eq("auth_user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = (data?.[0] as RequestRow | undefined) ?? null;
      setRequest(row);
      setPhase(row ? "requested" : "ready");
    },
    [client]
  );

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    // There's no sign-out button on the page; `?signout` is the way to
    // switch accounts (used for testing).
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

  // While requests are closed, the screen shows the lineup and each comic's own status.
  const showDayOn = !open && !!config.lineup_url;
  // Show day (Fri 6 AM until requests reopen): a signed-in comic's card already says what
  // they need, so the Open/Closed pill is left out. Also hidden while we find out who's signed in,
  // so it doesn't flash for returning comics.
  const hidePill = showDayOn && isLineupTime(window_, now) && (phase === "loading" || !!user);

  if (!client) {
    return (
      <p className="mx-4 my-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sign-up isn&apos;t connected yet.
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
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
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{config.show_name ?? "Read The Room"}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">{showDate}</h1>
          </div>
        </div>
        {!hidePill && (
        <div
          role="status"
          className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
            open ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"
          }`}
        >
          <span className="relative flex h-2.5 w-2.5">
            {open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${open ? "bg-emerald-400" : "bg-amber-400"}`} />
          </span>
          {open
            ? `Open · closes ${formatWeekTime(window_.closesWeekday, window_.closesMinutes)}`
            : `Sign ups are closed - reopens ${reopenLabel(window_, now)}`}
        </div>
        )}
      </header>

      {user && phase !== "loading" && phase !== "code" && (
        <div className="mt-5 rounded-xl bg-muted/70 px-4 py-3 text-sm">
          <p className="truncate text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{profile.stage_name || user.email}</span>
          </p>
        </div>
      )}

      <div className="mt-6">
        {phase === "loading" && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {phase === "email" && (
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
          open ? (
            <RequestForm
              client={client}
              user={user}
              profile={profile}
              onRequested={(row) => {
                setRequest(row);
                setPhase("requested");
              }}
            />
          ) : showDayOn ? (
            <ShowDayScreen client={client} userId={user.id} signedIn requested={false} config={config} dateLabel={showDate} window={window_} now={now} />
          ) : (
            <ClosedCard name={profile.stage_name} />
          )
        )}

        {phase === "requested" && request && (showDayOn ? (
          <ShowDayScreen client={client} userId={user?.id} signedIn requested config={config} dateLabel={showDate} window={window_} now={now} />
        ) : (
          <RequestedCard request={request} showDate={showDate} config={config} timeZone={window_.timeZone} />
        ))}

      </div>
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
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <CircleCheck className="h-6 w-6 shrink-0 text-emerald-400" aria-hidden="true" />
        <p className="text-lg font-bold leading-snug">First time or returning, all we need is your email.</p>
      </div>
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
        aria-label="6-digit code"
        autoFocus
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        value={code}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
          setCode(next);
          if (next.length === CODE_LENGTH && !busy) void verify(next);
        }}
        placeholder="••••••"
        className="mt-4 h-16 w-full rounded-xl border bg-background text-center font-mono text-3xl tracking-[0.5em] outline-none focus:border-primary"
      />
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {resent && !error && <p className="mt-3 text-sm text-emerald-300">New code sent.</p>}
      <button
        type="submit"
        disabled={busy || code.length !== CODE_LENGTH}
        className={`mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl ${CTA} text-lg font-bold disabled:opacity-60`}
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}
        Continue
      </button>
      <div className="mt-4 flex justify-between text-sm">
        <button type="button" onClick={onBack} className="text-muted-foreground underline-offset-2 hover:underline">
          Change email
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="text-muted-foreground underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60"
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
}: {
  client: SupabaseClient;
  user: User;
  profile: Profile;
  onRequested: (row: RequestRow) => void;
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
      // Not fatal: the request below still carries the details.
      await client.auth.updateUser({ data: next });
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
  request,
  showDate,
  config,
  timeZone,
}: {
  request: RequestRow;
  showDate: string;
  config: OpenMicSignupBlockConfig;
  timeZone: string;
}) {
  const at = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(request.created_at));

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="h-7 w-7" strokeWidth={3} />
      </div>
      <h2 className="mt-4 text-xl font-bold">You&apos;re on the request list for {showDate}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Requested {at.replace(/, (\d+:)/, " · $1")}</p>
      <div className="mt-5 rounded-xl border bg-background p-4 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">What happens next</p>
        <ol className="mt-3 space-y-3 text-sm">
          <li>
            <span className="font-semibold">Thursday</span> — if you&apos;re selected, we&apos;ll email you.
          </li>
          <li>
            <span className="font-semibold">{showDate.split(",")[0]}</span> — {config.show_name ?? "the show"}
            {config.venue ? ` at ${config.venue}` : ""}
            {config.show_time ? `, ${config.show_time.replace(/^Fridays\s*/i, "")}` : ""}. Not selected? You can request
            again next week.
          </li>
        </ol>
      </div>
    </div>
  );
}

function ClosedCard({ name }: { name: string }) {
  return (
    <div className="rounded-2xl border bg-muted/60 p-6 text-center">
      <h2 className="text-lg font-bold">Requests are closed for this week</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {name ? `${name.split(/\s+/)[0]}, the` : "The"} list reopens right after the show. You&apos;re signed in, so it&apos;ll be one
        tap.
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

function profileOf(user: User | null): Profile {
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

function friendlyAuthError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("expired") || m.includes("invalid")) return "That code didn't work. Use the newest email, or send a new code.";
  if (m.includes("rate limit")) return "Too many emails right now. Try again in a few minutes.";
  const wait = m.match(/after (\d+) seconds?/);
  if (wait) return `Wait ${wait[1]} seconds, then try again.`;
  if (m.includes("email")) return "Check that your email address is right.";
  return "Something went wrong. Try again.";
}

/** Re-renders every 30 s so the open/closed state flips on time. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** The lineup feed, refreshed every minute while the screen is showing. */
function useLineup(url: string | undefined, client: SupabaseClient, userId: string | undefined, enabled: boolean) {
  const [feed, setFeed] = useState<LineupFeed | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url || !enabled) return;
    let cancelled = false;
    async function load() {
      try {
        const { data } = await client.auth.getSession();
        const token = data.session?.access_token;
        const res = await fetch(url!, { headers: token ? { authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as LineupFeed;
        if (!cancelled) {
          setFeed(json);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [url, client, userId, enabled]);
  return { feed, failed };
}

/** Loads the feed and works out which message this visitor sees. */
function ShowDayScreen({
  client,
  userId,
  signedIn,
  requested,
  config,
  dateLabel,
  window,
  now,
}: {
  client: SupabaseClient;
  userId: string | undefined;
  signedIn: boolean;
  requested: boolean;
  config: OpenMicSignupBlockConfig;
  dateLabel: string;
  window: WeeklyWindow;
  now: Date;
}) {
  // Thursday 10 PM to Friday 6 AM nothing about selections or the lineup is shown, so nothing is fetched.
  const lineupTime = isLineupTime(window, now);
  const { feed, failed } = useLineup(config.lineup_url, client, userId, lineupTime);
  const state = showDayState({ signedIn, requested, feed, failed, lineupTime });
  return <ShowDay state={state} feed={feed} failed={failed} config={config} dateLabel={dateLabel} today={isShowDay(window, now)} lineupTime={lineupTime} dismissKey={`openmic-in-dismissed:${userId ?? "anon"}:${dateLabel}`} />;
}

/** Show day (Thu 10 PM to Fri 9:40 PM): the comic's own status, then the lineup. */
function ShowDay({
  state,
  feed,
  failed,
  config,
  dateLabel,
  today,
  lineupTime,
  dismissKey,
}: {
  state: ShowDayState;
  feed: LineupFeed | null;
  failed: boolean;
  config: OpenMicSignupBlockConfig;
  dateLabel: string;
  today: boolean;
  lineupTime: boolean;
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
  const weekday = dateLabel.split(",")[0];
  const mine = feed?.me;

  return (
    <div className="space-y-4">
      {state === "closed-night" && (
        <div className="rounded-2xl border bg-muted/60 p-6">
          <h2 className="text-xl font-bold">{CLOSED_NIGHT_COPY.title}</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{CLOSED_NIGHT_COPY.body}</p>
        </div>
      )}

      {state === "selected" && mine && !dismissed && (
        <div className="relative rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            title="Dismiss"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-7 w-7" strokeWidth={3} />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold">You&apos;re in!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {config.show_name ?? "The show"}
            {config.venue ? ` at ${config.venue}` : ""} · {dateLabel}
          </p>
        </div>
      )}

      {state === "not-selected" && (
        <div className="rounded-2xl border bg-muted/60 p-6">
          <h2 className="text-xl font-bold">{notSelected.title}</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{notSelected.body}</p>
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
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Requests open {reopenPhrase(today)}. You&apos;re signed in, so it&apos;ll be one tap.
          </p>
        </div>
      )}

      {state === "unavailable" && (
        <div className="rounded-2xl border bg-muted/60 p-6">
          <h2 className="text-xl font-bold">We couldn&apos;t load the lineup</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">Try again in a minute.</p>
        </div>
      )}

      {lineupTime && config.show_lineup !== false && feed?.posted && feed.lineup.length > 0 && (
        <section aria-label="Lineup" className="rounded-2xl border bg-muted/40 p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{today ? "Tonight's lineup" : `${weekday}'s lineup`}</h2>
          <ol className="mt-3 divide-y divide-border/70">
            {feed.lineup.map((entry, i) => (
              <li key={`${entry.name}-${i}`} className="flex items-baseline gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-base font-semibold">{entry.name}</span>
                <span className="w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{entry.set_length}</span>
                <span className="w-[4.5rem] shrink-0 text-right text-sm tabular-nums text-muted-foreground">{entry.start_time}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
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
