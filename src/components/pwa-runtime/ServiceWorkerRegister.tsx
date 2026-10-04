"use client";

import { useEffect } from "react";
import { decideOnControllerChange } from "@/lib/pwa/sw-update";

const RELOAD_KEY = "sw-update-reload-at";

const isTyping = () => {
  const el = document.activeElement;
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/** Last reload this code caused, kept for the tab's life so a reload can't repeat within the minimum gap. */
const lastReload = () => {
  try {
    return Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
  } catch {
    return 0;
  }
};
const reload = () => {
  try {
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // storage blocked: the reload still happens, just without the loop guard
  }
  window.location.reload();
};

/**
 * Registers the tenant app's service worker (served relative to its own subdomain by
 * `app/published-apps/[appSlug]/sw.js/route.ts`) and keeps the page current:
 * - checks for a new version every time the app comes back to the front (a tab left open, or an app on the Home Screen);
 * - when a new version takes over, reloads so the page runs it, unless the person is typing (then it waits until they
 *   return to the app), and never more than once every 30 seconds.
 * A no-op in unsupported browsers: a published PWA still works as a plain web page without offline support.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const hadController = !!navigator.serviceWorker.controller;
    let registration: ServiceWorkerRegistration | undefined;
    let waiting = false;

    const onControllerChange = () => {
      const decision = decideOnControllerChange({ hadController, typing: isTyping(), lastReloadAt: lastReload(), now: Date.now() });
      if (decision === "reload") reload();
      else if (decision === "wait") waiting = true;
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (waiting && !isTyping()) {
        waiting = false;
        reload();
        return;
      }
      registration?.update().catch(() => {});
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => {
        registration = r;
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, []);

  return null;
}
