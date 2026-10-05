"use client";

import { useSyncExternalStore } from "react";

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

const OPTIONS: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

export function formatLocal(iso: string, dateOnly: boolean, locale?: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, dateOnly ? { dateStyle: "medium", timeZone } : { ...OPTIONS, timeZone }).format(date);
}

export function formatUtc(iso: string, dateOnly: boolean): string {
  const text = formatLocal(iso, dateOnly, "en-US", "UTC");
  return dateOnly || !text ? text : `${text} UTC`;
}
