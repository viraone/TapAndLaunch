import { useSyncExternalStore } from "react";

/**
 * Who is signed in on this phone, for the app header's corner button (the initials circle with the first name
 * under it). Every StageTime screen already learns who is signed in (syncChatTabs); the header lives in the app's
 * layout, outside those screens, so the name is kept here, like the nav switches, and the header listens.
 */
const KEY = "tl-signed-in-name";
const EVENT = "tl-signed-in-name";

export interface SignedInName {
  id: string;
  name: string;
}

let cached: { raw: string | null; value: SignedInName | null } = { raw: null, value: null };

function read(): SignedInName | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === cached.raw) return cached.value;
  let value: SignedInName | null = null;
  try {
    const v = JSON.parse(raw ?? "null") as Partial<SignedInName> | null;
    if (v && typeof v.id === "string" && typeof v.name === "string" && v.name) value = { id: v.id, name: v.name };
  } catch {
    // A stray value: treated as signed out.
  }
  cached = { raw, value };
  return value;
}

/** Remember the signed-in person's name, or clear it (null) on sign-out. */
export function setSignedInName(next: SignedInName | null): void {
  try {
    if (next && next.name) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private mode): the header just keeps its plain icon.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** What is stored now, so a screen that only has the email never overwrites a host's name. */
export function readSignedInName(): SignedInName | null {
  return read();
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The signed-in name for the header; null on the server and while signed out. */
export function useSignedInName(): string | null {
  return useSyncExternalStore(subscribe, () => read()?.name ?? null, () => null);
}

/** "Viradeth Chan" → "Viradeth"; "a.b@mail.com" → "a.b". What fits under the avatar. */
export function shortName(name: string): string {
  return name.split("@")[0]!.trim().split(/\s+/)[0] ?? name;
}

/** Up to two initials from a stage name or email, for the avatar circle. */
export function initialsOf(name: string): string {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}
