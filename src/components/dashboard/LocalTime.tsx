"use client";

import { useSyncExternalStore } from "react";
import { formatDay, formatDayTime } from "@/lib/format-date";

const noopSubscribe = () => () => {};

/**
 * A date and time shown in the viewer's own time zone and language. Dashboard pages render on the
 * server, which runs in UTC, so formatting there would show everyone UTC. The server render (and the
 * first client render) says "UTC" outright, then the browser swaps in the local time.
 */
export function LocalTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => formatLocal(iso, dateOnly),
    () => formatUtc(iso, dateOnly)
  );
  return <time dateTime={iso}>{text}</time>;
}

export function formatLocal(iso: string, dateOnly: boolean, _locale?: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return dateOnly ? formatDay(date, timeZone) : formatDayTime(date, timeZone);
}

export function formatUtc(iso: string, dateOnly: boolean): string {
  const text = formatLocal(iso, dateOnly, "en-US", "UTC");
  return dateOnly || !text ? text : `${text} UTC`;
}
