"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import type { GroupChatBlockConfig } from "@/types/database";
import { PushOptIn } from "./PushOptIn";
import { GroupChatMessageList, type GroupChatMessage } from "./GroupChatMessageList";

/**
 * A published app's group chat: the class's own message list, only for people whose email is on the app's
 * `group_chat_members` list (migration 0050). The page is public; nothing here is readable without a signed-in
 * member whose email is on that list, and the list itself is never in the block's config or any response.
 *
 * Polling, not realtime: this app's readers are cookie members, not Supabase Auth users, so the browser asks the
 * service-role route for what is new every four seconds while the chat is on screen. The route returns `mine` per
 * message; another member's account id, email or role list never reaches the browser.
 */

const POLL_MS = 4000;

interface Viewer {
  member_id: string;
  display_name: string;
  role: "student" | "teacher";
}

type Status = "loading" | "sign_in" | "not_on_list" | "error" | "ok";
type SignInStep = "email" | "code";

function mergeMessages(prev: GroupChatMessage[], incoming: GroupChatMessage[]): GroupChatMessage[] {
  const byId = new Map(prev.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** Air between the composer and the app's bottom tab bar, and between it and the screen's edge when there is no bar. */
const BAR_GAP = 8;
const EDGE_GAP = 16;

/**
 * The top of `el` in the page's own coordinates. `getBoundingClientRect().top` would answer for wherever the page is
 * scrolled to, so the chat would resize itself as the reader scrolled; this does not move.
 */
function pageTop(el: HTMLElement): number {
  let top = 0;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) top += node.offsetTop;
  return top;
}

/** The app's bottom tab bar, if it has one: the floating "tabs" style over the page, or the compact bar under it. */
function findBottomBar(viewportHeight: number): HTMLElement | null {
  let bar: HTMLElement | null = null;
  for (const nav of document.querySelectorAll<HTMLElement>("nav")) {
    const rect = nav.getBoundingClientRect();
    // A bar hidden on wide screens has no size; a menu at the top of the page is not the bar the composer must clear.
    if (rect.width === 0 || rect.height === 0 || rect.top < viewportHeight / 2) continue;
    if (!bar || rect.top < bar.getBoundingClientRect().top) bar = nav;
  }
  return bar;
}

/** Is this element fixed to the screen (the floating tab bar) rather than laid out at the end of the page? */
function isFixedToScreen(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).position === "fixed") return true;
  }
  return false;
}

export function GroupChatRuntime({ config }: { config: GroupChatBlockConfig }) {
  const pathname = usePathname();
  // Normally the chat is served from the app's own address and these paths are plain (/group-chat/messages). The
  // /published-apps prefix only appears if the route tree is opened directly, as the dashboard does.
  const apiBase = useMemo(() => /^\/published-apps\/[^/]+/.exec(pathname)?.[0] ?? "", [pathname]);
  // After signing in or creating an account, come back to this page. The member pages honor ?next=.
  const returnTo = /^\/[a-z0-9/-]*$/.test(pathname) ? pathname : "/group-chat";
  const timeZone = config.time_zone || "America/Los_Angeles";

  const [status, setStatus] = useState<Status>("loading");
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [pollError, setPollError] = useState("");
  // Passwordless sign-in: the email step, then the six-digit code step.
  const [signInStep, setSignInStep] = useState<SignInStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const lastId = useRef(0);
  const inFlight = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  // The pinned column and its height, measured against the app's real chrome (the layout effect below).
  const column = useRef<HTMLElement>(null);
  const safeArea = useRef<HTMLSpanElement>(null);
  const [columnHeight, setColumnHeight] = useState<number | null>(null);

  const clearChat = useCallback(() => {
    setMessages([]);
    setViewer(null);
    lastId.current = 0;
  }, []);

  const load = useCallback(
    async (mode: "initial" | "poll") => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const cursor = mode === "poll" && lastId.current > 0 ? `?after=${lastId.current}` : "";
        const res = await fetch(`${apiBase}/group-chat/messages${cursor}`, { cache: "no-store" });
        if (res.status === 401) {
          clearChat();
          setStatus("sign_in");
          return;
        }
        if (res.status === 403) {
          clearChat();
          setStatus("not_on_list");
          return;
        }
        if (!res.ok) {
          if (mode === "initial") setStatus("error");
          else setPollError("Couldn't check for new messages.");
          return;
        }
        const data = (await res.json()) as { state?: string; viewer?: Viewer; messages?: GroupChatMessage[] };
        if (data.state !== "ok" || !data.viewer || !data.messages) {
          if (mode === "initial") setStatus("error");
          else setPollError("Couldn't check for new messages.");
          return;
        }
        const incoming = data.messages;
        setViewer(data.viewer);
        setMessages((prev) => (mode === "initial" ? incoming : mergeMessages(prev, incoming)));
        for (const message of incoming) if (message.id > lastId.current) lastId.current = message.id;
        setPollError("");
        setStatus("ok");
      } catch {
        if (mode === "initial") setStatus("error");
        else setPollError("Couldn't check for new messages.");
      } finally {
        inFlight.current = false;
      }
    },
    [apiBase, clearChat]
  );

  // First load, once. Deferred a tick so the first paint is the loading state, not a cascade from inside the effect.
  useEffect(() => {
    const first = window.setTimeout(() => void load("initial"), 0);
    return () => window.clearTimeout(first);
  }, [load]);

  // While the chat is open, ask for what is new; a phone that was asleep catches up the moment it is visible again.
  useEffect(() => {
    if (status !== "ok") return;
    const tick = () => {
      if (document.visibilityState === "visible") void load("poll");
    };
    const interval = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [status, load]);

  // Signed out or not on the list: polling stops, but coming back to the tab checks once (the student may have signed
  // in in another tab, or the teacher may just have added them).
  useEffect(() => {
    if (status === "ok" || status === "loading") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void load("initial");
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [status, load]);

  // Stay at the newest message unless the reader has scrolled up to read older ones.
  useEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // The chat fills the screen from under the app's header (and announcement and member bars) down to just above its
  // bottom tab bar. A fixed `100dvh` guess ignored everything above it, so on a phone the composer ended up under the
  // floating tab bar; measure the real chrome instead. Re-measure when that frame changes: a bar is closed, a tab
  // appears, the phone turns, or the keyboard and the address bar shrink the visible page.
  useLayoutEffect(() => {
    if (status !== "ok") return;
    const el = column.current;
    if (!el) return;

    let frame = 0;
    let stopped = false;
    let measuredBar: HTMLElement | null = null;
    const resized = new ResizeObserver(() => schedule());

    // The app's own column: the bars and header above the chat are its children, so it sees them come and go.
    let shell: HTMLElement = el;
    while (shell.parentElement && shell.parentElement !== document.body) shell = shell.parentElement;

    function measure() {
      frame = 0;
      if (stopped) return;
      // A local copy, so the check holds inside this closure.
      const node = column.current;
      if (!node) return;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const bar = findBottomBar(viewportHeight);
      const safeBottom = safeArea.current?.offsetHeight ?? 0;
      // A floating bar is fixed over the page, so its own top edge (which already includes the phone's bottom inset)
      // is where the composer must stop. The compact bar is laid out at the end of the page, so its height is the room
      // it needs. With no bar at all, keep clear of the phone's home-indicator inset and leave a little air.
      const reserve = bar
        ? isFixedToScreen(bar)
          ? Math.max(0, viewportHeight - bar.getBoundingClientRect().top)
          : bar.getBoundingClientRect().height + safeBottom
        : safeBottom;
      // The published layout already pads the page bottom for the floating bar (`pb-[calc(env(safe-area-inset-bottom)
      // +7.5rem)]`), which is a little more room than the pill itself takes. Stop at that padding's edge instead of
      // inside it, so the chat column does not make the page taller than the screen.
      const layoutPad = parseFloat(getComputedStyle(shell).paddingBottom) || 0;
      const gap = bar ? Math.max(BAR_GAP, layoutPad - reserve) : EDGE_GAP;
      // `pageTop` (not the live rect) keeps the answer the same while messages scroll inside their own area.
      const next = Math.max(0, Math.round(viewportHeight - pageTop(node) - reserve - gap));
      setColumnHeight((prev) => (prev === next ? prev : next));
      if (bar !== measuredBar) {
        if (measuredBar) resized.unobserve(measuredBar);
        if (bar) resized.observe(bar);
        measuredBar = bar;
      }
    }

    function schedule() {
      if (frame || stopped) return;
      frame = requestAnimationFrame(measure);
    }

    resized.observe(document.documentElement);
    resized.observe(shell);
    for (const child of Array.from(shell.children)) if (child instanceof HTMLElement) resized.observe(child);

    // A close button, a flagged tab appearing or a late web font changes the frame without resizing the app column.
    const changed = new MutationObserver(() => {
      for (const child of Array.from(shell.children)) if (child instanceof HTMLElement) resized.observe(child);
      schedule();
    });
    changed.observe(shell, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });

    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule).catch(() => {});

    measure();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      resized.disconnect();
      changed.disconnect();
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [status]);

  const resetSignIn = () => {
    setSignInStep("email");
    setCode("");
    setAuthError("");
  };

  const signOut = async () => {
    try {
      await fetch(`${apiBase}/members/session`, { method: "DELETE" });
    } catch {
      // The screen still goes back to the sign-in card; the cookie will be checked again on the next load.
    }
    clearChat();
    resetSignIn();
    setStatus("sign_in");
  };

  /** Ask the server to email a code, then show the code step. The address stays put so a resend is one tap. */
  const requestCode = async () => {
    const address = email.trim();
    if (!address || authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const res = await fetch(`${apiBase}/group-chat/code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const data = (await res.json().catch(() => null)) as { state?: string; message?: string } | null;
      if (res.status === 403) {
        setAuthError(data?.message ?? "That email isn't on the class list. Ask your teacher.");
        return;
      }
      if (res.status === 429) {
        setAuthError(data?.message ?? "Too many codes sent. Try again in a little while.");
        return;
      }
      if (!res.ok || data?.state !== "sent") {
        setAuthError(data?.message ?? "We couldn't send the email. Try again.");
        return;
      }
      setCode("");
      setSignInStep("code");
    } catch {
      setAuthError("We couldn't send the email. Check your connection and try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  /** Check the typed code. On success the server has set the ordinary member session cookie, so re-fetch the chat. */
  const verifyCode = async () => {
    const address = email.trim();
    const entered = code.trim();
    if (authBusy) return;
    if (!/^\d{6}$/.test(entered)) {
      setAuthError("Type the 6-digit code from the email.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const res = await fetch(`${apiBase}/group-chat/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, code: entered }),
      });
      const data = (await res.json().catch(() => null)) as { state?: string; message?: string } | null;
      if (res.ok && data?.state === "ok") {
        setSignInStep("email");
        setCode("");
        setStatus("loading");
        // Coming back to the tab may have started a recheck before this sign-in; let it settle so `load` is not
        // skipped, then ask again with the new cookie.
        while (inFlight.current) await new Promise((resolve) => window.setTimeout(resolve, 50));
        await load("initial");
        return;
      }
      if (res.status === 403) {
        clearChat();
        setStatus("not_on_list");
        return;
      }
      if (data?.state === "expired") setAuthError(data.message ?? "That code has expired. Send a new one.");
      else if (data?.state === "too_many_attempts") setAuthError(data.message ?? "Too many tries. Send a new code.");
      else if (data?.state === "bad_code") setAuthError(data.message ?? "That code isn't right. Check the email and try again.");
      else if (res.status === 429) setAuthError(data?.message ?? "Too many tries. Send a new code.");
      else setAuthError(data?.message ?? "Couldn't sign you in. Try again.");
    } catch {
      setAuthError("Couldn't sign you in. Check your connection and try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`${apiBase}/group-chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, page: returnTo }),
      });
      if (res.status === 401) {
        clearChat();
        setStatus("sign_in");
        return;
      }
      if (res.status === 403) {
        clearChat();
        setStatus("not_on_list");
        return;
      }
      if (!res.ok) throw new Error(`Send failed (${res.status})`);
      const message = (await res.json()) as GroupChatMessage;
      stickToBottom.current = true;
      setMessages((prev) => mergeMessages(prev, [message]));
      if (message.id > lastId.current) lastId.current = message.id;
      setText("");
    } catch {
      setSendError("Your message didn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center px-4 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status !== "ok" || !viewer) {
    return (
      <section className="px-4 py-6">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-border bg-muted/40 p-6 text-center">
          <h2 className="text-xl font-semibold">Class chat</h2>
          {status === "sign_in" && signInStep === "email" && (
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void requestCode();
              }}
            >
              <p className="text-balance text-[17px] leading-snug text-muted-foreground">
                Type the email your teacher has. We&apos;ll email you a code.
              </p>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setAuthError("");
                }}
                placeholder="you@example.com"
                aria-label="Your email"
                className="mt-5 h-12 w-full rounded-xl border border-border bg-background px-4 text-[17px] outline-none focus:border-muted-foreground"
              />
              <button
                type="submit"
                disabled={authBusy || !email.trim()}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground active:opacity-80 disabled:opacity-40"
              >
                {authBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Email me a code"}
              </button>
              {authError && <p className="mt-3 text-[15px] text-destructive">{authError}</p>}
            </form>
          )}
          {status === "sign_in" && signInStep === "code" && (
            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void verifyCode();
              }}
            >
              <p className="text-balance text-[17px] leading-snug text-muted-foreground">Check your email for a 6-digit code.</p>
              <p className="mt-1 break-all text-[13px] text-muted-foreground">Sent to {email.trim()}</p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]*"
                required
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setAuthError("");
                }}
                placeholder="123456"
                aria-label="6-digit code"
                className="mt-5 h-14 w-full rounded-xl border border-border bg-background text-center text-[28px] font-semibold tracking-[0.3em] outline-none focus:border-muted-foreground"
              />
              <button
                type="submit"
                disabled={authBusy || code.length !== 6}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground active:opacity-80 disabled:opacity-40"
              >
                {authBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign in"}
              </button>
              {authError && <p className="mt-3 text-[15px] text-destructive">{authError}</p>}
              <div className="mt-4 flex items-center justify-center gap-4 text-[15px]">
                <button
                  type="button"
                  onClick={() => {
                    setSignInStep("email");
                    setCode("");
                    setAuthError("");
                  }}
                  className="text-muted-foreground underline"
                >
                  Use a different email
                </button>
                <button type="button" onClick={() => void requestCode()} disabled={authBusy} className="text-muted-foreground underline disabled:opacity-40">
                  Send a new code
                </button>
              </div>
            </form>
          )}
          {status === "not_on_list" && (
            <>
              <p className="mt-2 text-balance text-[17px] leading-snug text-muted-foreground">
                That email isn&apos;t on the class list. Ask your teacher.
              </p>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground active:opacity-80"
              >
                Use a different email
              </button>
            </>
          )}
          {status === "error" && (
            <>
              <p className="mt-2 text-balance text-[17px] leading-snug text-muted-foreground">Couldn&apos;t load the chat. Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => {
                  setStatus("loading");
                  void load("initial");
                }}
                className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground active:opacity-80"
              >
                Try again
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    // The pinned column: the header and composer stay put and only the messages scroll. Its height comes from the
    // layout effect above (a measured `columnHeight`; the class is only the first-frame guess), so on a phone the
    // composer always sits just above the tab bar, clear of the home indicator, with no page scroll to reach it.
    <section
      ref={column}
      className="mx-auto flex h-[calc(100dvh-12rem)] w-full max-w-md flex-col px-4 pt-5"
      style={columnHeight === null ? undefined : { height: columnHeight }}
    >
      {/* Measures `env(safe-area-inset-bottom)`: the strip the phone's home indicator lives in. */}
      <span
        ref={safeArea}
        aria-hidden
        className="pointer-events-none invisible fixed bottom-0 left-0 w-px"
        style={{ height: "env(safe-area-inset-bottom)" }}
      />
      <header className="shrink-0">
        <h2 className="text-2xl font-extrabold tracking-tight">{config.title || "Group chat"}</h2>
        {config.intro && <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{config.intro}</p>}
        <div className="mt-2 flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
          <span className="min-w-0 truncate">
            Signed in as <span className="font-medium text-foreground">{viewer.display_name}</span>
            {viewer.role === "teacher" && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-primary">
                Teacher
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <PushOptIn memberId={viewer.member_id} />
            <button type="button" onClick={signOut} className="underline">
              Sign out
            </button>
          </span>
        </div>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2"
      >
        {messages.length === 0 ? (
          <p className="text-balance px-6 py-16 text-center text-[17px] text-muted-foreground">No messages yet. Say hello.</p>
        ) : (
          <GroupChatMessageList messages={messages} timeZone={timeZone} />
        )}
      </div>

      {(sendError || pollError) && <p className="shrink-0 pb-1 text-center text-[13px] text-destructive">{sendError || pollError}</p>}

      <form
        className="flex shrink-0 items-end gap-2 border-t border-border py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a computer; on a phone the return key adds a line and the arrow sends.
            if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Message"
          aria-label="Message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-muted px-4 py-2.5 text-[16px] leading-snug outline-none [field-sizing:content] focus:border-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={sending || !text.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground active:opacity-80 disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-6 w-6" strokeWidth={2.5} />}
        </button>
      </form>
    </section>
  );
}
