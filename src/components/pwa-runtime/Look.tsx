"use client";

import { createContext, useContext, useEffect } from "react";
import type { LookId } from "@/lib/pwa/look";

/**
 * The look of the site being rendered (lib/pwa/look.ts), for the sections that draw themselves differently per look.
 * Provided once by the published layout and once by the builder's preview frame; unset means classic, so every app
 * that predates looks renders exactly as before.
 */
const LookContext = createContext<LookId>("classic");

export function LookProvider({ look, children }: { look: LookId; children: React.ReactNode }) {
  return <LookContext.Provider value={look}>{children}</LookContext.Provider>;
}

export function useLook(): LookId {
  return useContext(LookContext);
}

/**
 * Reveal-on-scroll for the published site: sections marked `data-reveal` fade and rise into place as they enter the
 * viewport. Progressive: the stylesheet only hides them once this has run (`data-reveal-ready` on <html>), so a page
 * with JavaScript off, a crawler, or a slow script still shows everything; and `prefers-reduced-motion` turns the
 * motion off in CSS.
 *
 * The layout mounts once, so sections that arrive later (a page opened from the tab bar, which navigates without a
 * reload) are picked up by a MutationObserver. Without it they stayed hidden until a refresh.
 */
export function RevealObserver() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-reveal-ready", "");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-in", "");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" }
    );
    const watch = (scope: ParentNode) =>
      scope.querySelectorAll("[data-reveal]:not([data-in])").forEach((el) => io.observe(el));
    watch(document);
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches("[data-reveal]:not([data-in])")) io.observe(node);
          watch(node);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      root.removeAttribute("data-reveal-ready");
    };
  }, []);
  return null;
}
