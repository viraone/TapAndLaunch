// Which comic the host last picked in the Timer tab's "Who" box. Kept in the browser so leaving the tab and
// coming back shows the same comic. It is tied to one show date, so next week's show starts on "Everyone".

export const TIMER_TARGET_KEY = "openmic-timer-target";

export type TimerTarget = { date: string; key: string };

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The browser's store, or null on the server or when the browser blocks storage. */
export function timerTargetStore(): Store | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Storage is blocked (some private modes): the pick then lasts only while the tab is open.
    return null;
  }
}

/** The stored pick, or an empty one when nothing usable is stored. */
export function readTimerTarget(store: Store | null): TimerTarget {
  const empty: TimerTarget = { date: "", key: "" };
  if (!store) return empty;
  try {
    const parsed: unknown = JSON.parse(store.getItem(TIMER_TARGET_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return empty;
    const { date, key } = parsed as Record<string, unknown>;
    return typeof date === "string" && typeof key === "string" ? { date, key } : empty;
  } catch {
    // A broken value or blocked storage: start on "Everyone".
    return empty;
  }
}

/** Stores the pick; "Everyone" (an empty key) removes it. */
export function writeTimerTarget(store: Store | null, target: TimerTarget): void {
  if (!store) return;
  try {
    if (target.key === "") store.removeItem(TIMER_TARGET_KEY);
    else store.setItem(TIMER_TARGET_KEY, JSON.stringify(target));
  } catch {
    // Storage blocked or full: the pick still holds while the tab is open.
  }
}

/** The key to show for this show date: a stored pick only counts for the date it was made for. */
export function targetKeyFor(target: TimerTarget, date: string): string {
  return target.date === date ? target.key : "";
}
