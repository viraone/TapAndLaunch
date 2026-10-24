"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BellRing, Loader2 } from "lucide-react";
import { pushSupport, vapidKeyBytes } from "@/lib/openmic/push";

type Status = "checking" | "ios-not-installed" | "unsupported" | "denied" | "off" | "on" | "working";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * StageTime: a comic turns on "You're up next!" pushes for this phone. A visible button, never a prompt on load.
 * The subscription goes to the server with the comic's own token and their stage name, which is what the hosts'
 * Remote tab matches the highlighted lineup row against; when `name` later changes (the exact lineup-row name on
 * show day), a phone that is already on re-sends itself so the match is exact. On an iPhone in Safari the card
 * explains the Home Screen step instead, since iOS only allows pushes from an installed app.
 */
export function OpenMicPushOptIn({ client, name }: { client: SupabaseClient; name: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [problem, setProblem] = useState<string | null>(null);
  const syncedName = useRef<string | null>(null);

  // Browser-only reads (permission, the live subscription), so after hydration; the state lands from the promise.
  useEffect(() => {
    let cancelled = false;
    const check = async (): Promise<Status> => {
      const support = pushSupport({
        serviceWorker: "serviceWorker" in navigator,
        pushManager: "PushManager" in window,
        notification: "Notification" in window,
        userAgent: navigator.userAgent,
        standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
      });
      if (support !== "ok") return support;
      if (Notification.permission === "denied") return "denied";
      if (Notification.permission === "default") return "off";
      const registration = await navigator.serviceWorker.ready;
      return (await registration.pushManager.getSubscription()) ? "on" : "off";
    };
    void check().then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const token = useCallback(async (): Promise<string | undefined> => {
    const { data } = await client.auth.getSession();
    return data.session?.access_token;
  }, [client]);

  const send = useCallback(
    async (subscription: PushSubscription, forName: string): Promise<boolean> => {
      const res = await fetch("/openmic/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: await token(), name: forName, subscription: subscription.toJSON() }),
      });
      return res.ok;
    },
    [token]
  );

  // A phone that is on keeps its stored name current (once per name), so the lineup-row name always matches.
  useEffect(() => {
    if (status !== "on" || !name || syncedName.current === name) return;
    syncedName.current = name;
    void navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await send(subscription, name);
    });
  }, [status, name, send]);

  async function turnOn() {
    if (!VAPID_PUBLIC_KEY) return;
    setStatus("working");
    setProblem(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setStatus(permission === "denied" ? "denied" : "off");
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY) }));
      if (!(await send(subscription, name))) throw new Error("subscribe failed");
      syncedName.current = name;
      setStatus("on");
    } catch {
      setProblem("That didn't work. Check the connection and try again.");
      setStatus("off");
    }
  }

  async function turnOff() {
    setStatus("working");
    setProblem(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/openmic/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: await token(), endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      syncedName.current = null;
      setStatus("off");
    } catch {
      setProblem("That didn't work. Try again.");
      setStatus("on");
    }
  }

  if (!VAPID_PUBLIC_KEY || status === "checking" || status === "unsupported") return null;

  const body =
    status === "on"
      ? "Notifications are on for this phone. When the host calls your name, it buzzes, even with the app closed."
      : status === "ios-not-installed"
        ? "On iPhone, first add this app to your Home Screen: tap Share, then Add to Home Screen. Open it from there and turn notifications on."
        : status === "denied"
          ? "Notifications are blocked for this app in your phone's settings. Allow them there, then come back."
          : "When the host calls your name, this phone gets a notification, even with the app closed.";

  return (
    <section aria-label="Up-next notifications" className="rounded-2xl border bg-muted/60 p-5">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold">{status === "on" ? "You'll get buzzed when you're up next" : "Get buzzed when you're up next"}</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
          {(status === "off" || status === "working") && (
            <button
              type="button"
              onClick={() => void turnOn()}
              disabled={status === "working"}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#dc2626] text-[17px] font-semibold text-white active:bg-[#991b1b] disabled:opacity-60"
            >
              {status === "working" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
              {status === "working" ? "Working…" : "Turn on notifications"}
            </button>
          )}
          {status === "on" && (
            <button type="button" onClick={() => void turnOff()} className="mt-3 text-[15px] font-semibold text-muted-foreground underline underline-offset-4">
              Turn off on this phone
            </button>
          )}
          {problem && <p className="mt-2 text-[14px] font-semibold text-red-400">{problem}</p>}
        </div>
      </div>
    </section>
  );
}
