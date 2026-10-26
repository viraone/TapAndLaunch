"use client";

import { useCallback, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import type { ThemeConfig } from "@/types/database";

// Every `useLocalFlag` caller in this tab shares one listener set, so writing one key wakes every reader (cheap:
// each just re-checks its own key) — that's what makes the bar/notice disappear the instant it's dismissed.
const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Reads a localStorage key on the client only, matching it against `okValue`. Server-rendered HTML (and hydration)
 * always sees `false` — the real value syncs in right after, without a `setState`-in-effect (localStorage is an
 * external store, which is exactly what `useSyncExternalStore` is for). */
function useLocalFlag(storageKey: string, okValue: string): [boolean, (value: boolean) => void] {
  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(storageKey) === okValue;
    } catch {
      return false;
    }
  }, [storageKey, okValue]);
  const getServerSnapshot = useCallback(() => false, []);
  const flag = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setFlag = useCallback(
    (value: boolean) => {
      try {
        if (value) window.localStorage.setItem(storageKey, okValue);
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* fine: the choice just won't be remembered next visit */
      }
      listeners.forEach((onChange) => onChange());
    },
    [storageKey, okValue]
  );
  return [flag, setFlag];
}

/** A line across the top of every page ("Tickets for Friday are on sale"), with a link; the visitor can close it. */
export function AnnouncementBar({ theme, preview = false }: { theme: ThemeConfig; preview?: boolean }) {
  const a = theme.announcement;
  const key = `tl-announcement:${a?.text ?? ""}`;
  const [storedClosed, setStoredClosed] = useLocalFlag(key, "closed");
  const closed = !preview && storedClosed;
  if (!a?.enabled || !a.text?.trim() || closed) return null;
  const href = a.url?.trim();
  const body = <span className="text-sm font-semibold">{a.text}</span>;
  return (
    // Extra room on top on phones: Safari draws a dark fade under the clock and battery that would cover the first line.
    <div className="flex items-center justify-center gap-3 bg-primary px-4 pb-2.5 pt-5 text-center text-primary-foreground lg:pt-2.5">
      {href && !preview ? (
        <a href={/^https?:\/\//i.test(href) ? href : `/${href.replace(/^\/+/, "")}`} className="underline-offset-2 hover:underline">
          {body}
        </a>
      ) : (
        body
      )}
      {!preview && (
        <button type="button" aria-label="Close" onClick={() => setStoredClosed(true)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-white/15">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** A small notice about cookies, shown once until it is accepted. Only the owner's choice; nothing here sets cookies. */
export function CookieNotice({ theme }: { theme: ThemeConfig }) {
  const [accepted, setAccepted] = useLocalFlag("tl-cookies", "ok");
  if (!theme.cookie_notice || accepted) return null;
  return (
    <div role="dialog" aria-label="Cookies" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl bg-neutral-950 p-4 text-sm text-white shadow-2xl ring-1 ring-white/15 lg:bottom-6">
      <p>This site uses cookies to remember your choices and to count visits.</p>
      <button type="button" onClick={() => setAccepted(true)} className="mt-3 inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold text-neutral-950">
        OK
      </button>
    </div>
  );
}
