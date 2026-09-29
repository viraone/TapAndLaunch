"use client";

import { useSyncExternalStore } from "react";
import type { RuntimeListing } from "@/lib/pwa/listings";
import { ListingDirectoryView } from "@/components/pwa-runtime/ListingDirectoryView";

function subscribeToClock(onTick: () => void) {
  const timer = window.setInterval(onTick, 10_000);
  return () => window.clearInterval(timer);
}

/** The current minute, so React re-renders only when the minute changes. */
function getCurrentMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

/** The server has no "now" for the viewer: it renders the loading line. */
function getServerMinute(): null {
  return null;
}

/** Reads the clock only in the browser, so the server and the browser never
 * disagree about what "today" is. Like StageTime, it keeps checking, so the
 * Next Open Mic badge moves on as the night goes. */
export function ListingDirectoryRuntime({ listings }: { listings: RuntimeListing[] }) {
  const minute = useSyncExternalStore(subscribeToClock, getCurrentMinute, getServerMinute);

  if (minute === null) {
    return <p className="text-sm text-muted-foreground">Loading today&apos;s open mics…</p>;
  }
  return <ListingDirectoryView listings={listings} now={new Date(minute * 60_000)} />;
}
