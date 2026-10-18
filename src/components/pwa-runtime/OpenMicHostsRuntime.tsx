"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { PINNED_PAGE, useOpenMicClient } from "./OpenMicSignupRuntime";
import { ChatThread, joinNames, markThreadRead } from "./OpenMicChatThread";
import { markHostChatSeen, syncChatTabs } from "@/lib/openmic/host-chat";

/**
 * StageTime's Hosts tab, for the show's hosts (Viradeth, Nick and Noah) only. Two parts:
 *   - Hosts chat: their own group thread (host_messages).
 *   - Comedians: an inbox of the comedians who have written on "Message the Hosts", one private thread each
 *     (comedian_messages), with unread counts for this host. Opening a thread marks it read.
 * Data and access rules live in the show's Supabase project (slotted-killer migrations 20261018000000 and
 * 20261018010000). New messages arrive over realtime; new comedian messages also email the hosts (notify-hosts).
 */

type Part = "hosts" | "comedians";

interface Thread {
  comedian_id: string;
  comedian_name: string;
  last_at: string;
  last_body: string | null;
  last_from_host: boolean;
  last_author: string;
  last_has_photo: boolean;
  unread: number;
}

export function OpenMicHostsRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  const client = useOpenMicClient(config);
  const timeZone = config.time_zone ?? "America/Los_Angeles";
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [member, setMember] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const check = async (u: User | null) => {
      setUser(u);
      void syncChatTabs(client, u);
      if (!u) return setMember(undefined);
      const { data } = await client.rpc("is_host_chat_member");
      if (!cancelled) setMember(data === true);
    };
    void client.auth.getSession().then(({ data }) => {
      if (!cancelled) void check(data.session?.user ?? null);
    });
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void check(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  if (!client) {
    return (
      <p className="mx-4 my-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Sign-in isn&apos;t connected yet.
      </p>
    );
  }
  if (user === undefined || (user && member === undefined)) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    return (
      <Notice heading="Hosts" title="Sign in to see the hosts' chat">
        <Link
          href="/signup"
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#dc2626] text-[17px] font-semibold text-white active:bg-[#991b1b]"
        >
          Sign in
        </Link>
      </Notice>
    );
  }
  if (!member) return <Notice heading="Hosts" title="This chat is only for the show's hosts." />;
  return <HostsScreen client={client} user={user} timeZone={timeZone} />;
}

/** A locked-out state: a heading, a padlock and one line, with room for a button. */
export function Notice({ heading, title, children }: { heading: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
      <h1 className="text-3xl font-black tracking-tight">{heading}</h1>
      <div className="mt-6 flex flex-col items-center rounded-xl bg-muted px-6 py-8 text-center">
        <span aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-background/60 text-muted-foreground">
          <Lock className="h-7 w-7" />
        </span>
        <p className="mt-4 text-balance text-[19px] font-semibold">{title}</p>
        {children}
      </div>
    </div>
  );
}

function HostsScreen({ client, user, timeZone }: { client: SupabaseClient; user: User; timeZone: string }) {
  // The Sign-Up screen's Messages card links here with ?part=comedians&thread=<comedian id>.
  const [link] = useState(() => new URLSearchParams(typeof window === "undefined" ? "" : window.location.search));
  const wantedThread = useRef(link.get("thread"));
  const [part, setPart] = useState<Part>(link.get("part") === "comedians" ? "comedians" : "hosts");
  const [names, setNames] = useState<string[]>([]);
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [open, setOpen] = useState<Thread | null>(null);

  const loadThreads = useCallback(
    () =>
      client.rpc("comedian_threads").then(({ data }) => {
        if (!data) return;
        const list = data as Thread[];
        setThreads(list);
        const wantedId = wantedThread.current;
        if (wantedId) {
          wantedThread.current = null;
          const t = list.find((x) => x.comedian_id === wantedId);
          if (t) setOpen(t);
        }
      }),
    [client]
  );

  useEffect(() => {
    void client.rpc("host_names").then(({ data }) => setNames((data as string[] | null) ?? []));
    const first = setTimeout(() => void loadThreads(), 0);
    // Any new comedian message (from anyone) changes the inbox: its order, preview and unread counts.
    const channel = client
      .channel("comedian-inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comedian_messages" }, () => void loadThreads())
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadThreads();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      void client.removeChannel(channel);
    };
  }, [client, loadThreads]);

  const unread = (threads ?? []).reduce((n, t) => n + t.unread, 0);

  if (open) {
    return (
      <div className={PINNED_PAGE}>
        <header className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setOpen(null);
              void loadThreads();
            }}
            className="-ml-2 flex h-11 items-center pr-2 text-[17px] text-primary"
          >
            <ChevronLeft className="h-7 w-7" />
            Comedians
          </button>
        </header>
        <h1 className="mt-1 shrink-0 truncate text-2xl font-black tracking-tight">{open.comedian_name}</h1>
        <p className="shrink-0 text-[15px] text-muted-foreground">Private: only {open.comedian_name} and the hosts see this.</p>
        <ChatThread
          key={open.comedian_id}
          client={client}
          user={user}
          timeZone={timeZone}
          source={{
            table: "comedian_messages",
            match: { comedian_id: open.comedian_id },
            insert: { comedian_id: open.comedian_id },
            bucket: "comedian-chat",
            folder: open.comedian_id,
            mine: (m) => !!m.from_host,
            emptyText: "No messages yet.",
            onSeen: (latest) => markThreadRead(client, user.id, open.comedian_id, latest),
          }}
        />
      </div>
    );
  }

  return (
    <div className={PINNED_PAGE}>
      <header className="shrink-0">
        <h1 className="text-3xl font-black tracking-tight">Hosts</h1>
        <div role="tablist" aria-label="Hosts tab sections" className="mt-3 grid grid-cols-2 rounded-xl bg-muted p-1">
          {(["hosts", "comedians"] as Part[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={part === p}
              onClick={() => setPart(p)}
              className={`flex h-10 items-center justify-center gap-2 rounded-lg text-[15px] font-semibold transition ${
                part === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {p === "hosts" ? "Hosts chat" : "Comedians"}
              {p === "comedians" && unread > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#dc2626] px-1.5 text-[12px] font-bold text-white">{unread}</span>
              )}
            </button>
          ))}
        </div>
        {part === "hosts" && names.length > 0 && (
          <p className="mt-3 text-[15px] text-muted-foreground">Only {joinNames(names)} can see this chat.</p>
        )}
        {part === "comedians" && (
          <p className="mt-3 text-[15px] text-muted-foreground">Comedians who wrote on Message the Hosts. Each thread is private to them and the hosts.</p>
        )}
      </header>

      {part === "hosts" ? (
        <ChatThread
          key="hosts"
          client={client}
          user={user}
          timeZone={timeZone}
          source={{
            table: "host_messages",
            bucket: "host-chat",
            folder: user.id,
            mine: (m, me) => m.author_id === me.id,
            emptyText: "No messages yet. Say hi.",
            onSeen: (latest) => markHostChatSeen(user.id, latest.created_at),
          }}
        />
      ) : (
        <Inbox threads={threads} timeZone={timeZone} onOpen={setOpen} />
      )}
    </div>
  );
}

function Inbox({ threads, timeZone, onOpen }: { threads: Thread[] | null; timeZone: string; onOpen: (t: Thread) => void }) {
  const [now] = useState(() => Date.now());
  const dayOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(new Date(ms));
  const when = (iso: string) => {
    const d = new Date(iso);
    if (dayOf(d.getTime()) === dayOf(now)) return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(d);
    if (now - d.getTime() < 6 * 86_400_000) return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(d);
    return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(d);
  };

  if (threads === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (threads.length === 0) {
    return <p className="text-balance px-6 py-16 text-center text-[17px] text-muted-foreground">No comedian has written yet.</p>;
  }
  return (
    <ul className="mt-4 min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain rounded-xl bg-muted">
      {threads.map((t) => (
        <li key={t.comedian_id}>
          <button type="button" onClick={() => onOpen(t)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-background/60">
            <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.unread > 0 ? "bg-[#dc2626]" : "bg-transparent"}`} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className={`truncate text-[17px] ${t.unread > 0 ? "font-bold" : "font-semibold"}`}>{t.comedian_name}</span>
                <span className="shrink-0 text-[13px] text-muted-foreground">{when(t.last_at)}</span>
              </span>
              <span className={`block truncate text-[15px] ${t.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                {t.last_from_host ? `${t.last_author}: ` : ""}
                {t.last_body ?? (t.last_has_photo ? "Photo" : "")}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}
