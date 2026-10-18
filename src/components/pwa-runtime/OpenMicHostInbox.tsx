"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Bell, ChevronRight, CircleCheck, Loader2 } from "lucide-react";
import { joinNames } from "./OpenMicChatThread";
import { markHostChatSeen, readHostChatSeen } from "@/lib/openmic/host-chat";

/**
 * The hosts' "Messages" card on the Sign-Up screen, under "Signed in as": what is waiting for this host. Two kinds:
 *   - Comedians: threads from "Message the Hosts" with messages this host hasn't read (comedian_threads keeps the
 *     per-host unread counts).
 *   - Hosts chat: messages from the other hosts since this phone last had the hosts' chat open (the chat has no read
 *     marks in the database, so "seen" is kept on the device: lib/openmic/host-chat.ts).
 * It refreshes live while the app is open. It does not alert a closed app: new comedian messages still email the hosts.
 */

export interface InboxThread {
  comedian_id: string;
  comedian_name: string;
  last_at: string;
  last_body: string | null;
  last_has_photo: boolean;
  unread: number;
}

export interface InboxChat {
  count: number;
  names: string[];
}

export function HostInbox({ client, user, timeZone }: { client: SupabaseClient; user: User; timeZone: string }) {
  const [threads, setThreads] = useState<InboxThread[] | null>(null);
  const [chat, setChat] = useState<InboxChat | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const [threadsRes, chatRes] = await Promise.all([client.rpc("comedian_threads"), loadChat(client, user.id)]);
    if (threadsRes.error || !chatRes) return setFailed(true);
    setFailed(false);
    setThreads(((threadsRes.data as InboxThread[] | null) ?? []).filter((t) => t.unread > 0));
    setChat(chatRes);
  }, [client, user.id]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    // Anything new in either place changes the card.
    const channel = client
      .channel("host-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comedian_messages" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "host_messages" }, () => void load())
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      void client.removeChannel(channel);
    };
  }, [client, load]);

  return <HostInboxView threads={threads} chat={chat} failed={failed} timeZone={timeZone} />;
}

/** Hosts-chat messages from other hosts newer than what this phone has seen; null if the lookup failed. */
async function loadChat(client: SupabaseClient, userId: string): Promise<InboxChat | null> {
  const seen = readHostChatSeen(userId);
  if (!seen) {
    // First time on this phone: start from now, so the whole chat history doesn't show up as new.
    const { data, error } = await client.from("host_messages").select("created_at").order("created_at", { ascending: false }).limit(1);
    if (error) return null;
    const latest = (data?.[0] as { created_at: string } | undefined)?.created_at;
    markHostChatSeen(userId, latest ?? new Date().toISOString());
    return { count: 0, names: [] };
  }
  const { data, error } = await client
    .from("host_messages")
    .select("author_name")
    .neq("author_id", userId)
    .gt("created_at", seen)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return null;
  const rows = (data ?? []) as { author_name: string }[];
  return { count: rows.length, names: [...new Set(rows.map((r) => r.author_name))] };
}

/** The card itself: also drawn by the local preview with made-up data. */
export function HostInboxView({
  threads,
  chat,
  failed = false,
  timeZone,
}: {
  threads: InboxThread[] | null;
  chat: InboxChat | null;
  failed?: boolean;
  timeZone: string;
}) {
  const [now] = useState(() => Date.now());
  const loading = threads === null || chat === null;
  const total = (threads ?? []).reduce((n, t) => n + t.unread, 0) + (chat?.count ?? 0);

  return (
    <section aria-label="Messages" className="rounded-2xl bg-muted">
      <div className="flex min-h-14 items-center gap-3 px-4 py-3">
        <Bell className="h-6 w-6 shrink-0 text-primary" aria-hidden />
        <h2 className="text-[17px] font-semibold">Messages</h2>
        <span
          className={`ml-auto rounded-full px-3 py-1 text-[15px] font-bold ${
            total > 0 ? "bg-[#dc2626] text-white" : "bg-background/60 text-muted-foreground"
          }`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Checking" /> : `${total} new`}
        </span>
      </div>

      {failed && loading ? (
        <p className="border-t border-border px-4 py-4 text-[15px] text-muted-foreground">Couldn&apos;t check for messages right now.</p>
      ) : !loading && total === 0 ? (
        <div className="flex items-start gap-3 border-t border-border px-4 py-4">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <div>
            <p className="text-[17px] font-semibold">You&apos;re all caught up</p>
            <p className="mt-0.5 text-[15px] text-muted-foreground">Messages from comedians and the other hosts show up here.</p>
          </div>
        </div>
      ) : !loading ? (
        <ul className="divide-y divide-border border-t border-border">
          {(threads ?? []).map((t) => (
            <li key={t.comedian_id}>
              <Row
                href={`/hosts?part=comedians&thread=${t.comedian_id}`}
                title={t.comedian_name}
                detail={t.last_body ?? (t.last_has_photo ? "Photo" : "")}
                meta={whenLabel(t.last_at, timeZone, now)}
                count={t.unread}
              />
            </li>
          ))}
          {chat && chat.count > 0 && (
            <li>
              <Row href="/hosts" title="Hosts chat" detail={`New from ${joinNames(chat.names)}`} count={chat.count} />
            </li>
          )}
        </ul>
      ) : null}
    </section>
  );
}

function Row({ href, title, detail, meta, count }: { href: string; title: string; detail: string; meta?: string; count: number }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 active:bg-background/60">
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#dc2626]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[17px] font-bold">{title}</span>
          {meta && <span className="shrink-0 text-[13px] text-muted-foreground">{meta}</span>}
        </span>
        <span className="block truncate text-[15px] text-foreground/85">{detail}</span>
      </span>
      {count > 1 && <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-[#dc2626] px-1.5 text-[13px] font-bold text-white">{count}</span>}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** "3:42 PM" today, the weekday within the last week, else "Oct 9". */
function whenLabel(iso: string, timeZone: string, now: number): string {
  const d = new Date(iso);
  const dayOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(new Date(ms));
  if (dayOf(d.getTime()) === dayOf(now)) return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(d);
  if (now - d.getTime() < 6 * 86_400_000) return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d);
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(d);
}
