"use client";

import { useEffect } from "react";

/**
 * Registers the tenant app's service worker (served relative to its own
 * subdomain by `app/published-apps/[appSlug]/sw.js/route.ts`) once the page has
 * loaded. A no-op — including in unsupported browsers — rather than
 * throwing, since a published PWA should still work as a plain web page
 * without offline support.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
