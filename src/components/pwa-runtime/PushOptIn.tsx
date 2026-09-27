"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // `new Uint8Array(length)` (unlike `Uint8Array.from`) is typed as backed
  // by a real `ArrayBuffer`, which is what `PushManager.subscribe`'s
  // `applicationServerKey: BufferSource` wants — see the TS lib.dom types.
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type Status = "unsupported" | "default" | "denied" | "subscribed" | "granted-not-subscribed" | "working";

/**
 * A visible opt-in/opt-out button, not an automatic permission prompt on
 * load — asking for notification permission unprompted is a well-known
 * anti-pattern (browsers increasingly auto-deny or de-prioritize sites that
 * do it). Renders nothing if push isn't supported, isn't configured
 * (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` unset), or the visitor denied permission —
 * "denied" is a hard no the browser enforces until the visitor changes it
 * in their own site settings, so there is nothing useful this button could
 * do.
 *
 * Tracks both `Notification.permission` (the browser-level grant) and
 * whether a `PushManager` subscription actually exists — they can diverge
 * (permission granted, but the subscription was never created or expired),
 * so permission alone isn't enough to know whether to offer "enable" or
 * "disable".
 */
export function PushOptIn() {
  const [status, setStatus] = useState<Status>("unsupported");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return;
    }

    // Deliberately in an effect, not a lazy `useState` initializer: these
    // read browser-only APIs that don't exist during SSR. Rendering
    // "unsupported" (this component's initial state) on the server and
    // fixing it up here after hydration avoids a hydration mismatch; a lazy
    // initializer would compute the real value during the client's first
    // render instead, which *is* the mismatch.
    async function checkStatus() {
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      if (Notification.permission === "default") {
        setStatus("default");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setStatus(subscription ? "subscribed" : "granted-not-subscribed");
    }
    void checkStatus();
  }, []);

  async function handleEnable() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;

    setStatus("working");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "default");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      await fetch("/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setStatus("subscribed");
    } catch (error) {
      console.error("Push subscription failed:", error);
      setStatus("granted-not-subscribed");
    }
  }

  async function handleDisable() {
    setStatus("working");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("granted-not-subscribed");
    } catch (error) {
      console.error("Push unsubscribe failed:", error);
      setStatus("subscribed");
    }
  }

  if (status === "unsupported" || status === "denied" || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return null;
  }

  if (status === "subscribed") {
    return (
      <button type="button" onClick={handleDisable} className="underline">
        Disable notifications
      </button>
    );
  }

  return (
    <button type="button" onClick={handleEnable} disabled={status === "working"} className="underline disabled:opacity-50">
      {status === "working" ? "Working…" : "Enable notifications"}
    </button>
  );
}
