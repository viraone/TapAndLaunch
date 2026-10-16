"use client";

import { useEffect } from "react";

/**
 * Loads font stylesheets once the page has appeared. The template previews lower on the page use other fonts, but a
 * normal `<link rel="stylesheet">` makes the whole page wait for each one before it shows anything (about three
 * seconds on a phone). The previews swap to their fonts a moment after the page is up.
 */
export function LateFonts({ hrefs }: { hrefs: string[] }) {
  useEffect(() => {
    const added: HTMLLinkElement[] = [];
    for (const href of hrefs) {
      if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
      added.push(link);
    }
    return () => added.forEach((l) => l.remove());
  }, [hrefs]);
  return null;
}
