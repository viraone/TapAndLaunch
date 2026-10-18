"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { ArrowUp, ImagePlus, Loader2, Lock } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { PINNED_PAGE, useOpenMicClient } from "./OpenMicSignupRuntime";
import { syncHostsTab } from "@/lib/openmic/host-chat";

/**
 * StageTime's Hosts tab: one group chat for the show's hosts (Viradeth, Nick and Noah), text and photos.
 *
 * Everything lives in the show's own Supabase project (migration 20261018000000_host_chat in slotted-killer):
 * host_chat_members says who is in the chat and the name shown over their messages; host_messages holds the
 * messages, readable and writable only by members (the author is set by the database, not the browser); photos are
 * in the private host-chat bucket and shown through short-lived signed links. New messages arrive over realtime.
 * There are no alerts: a host sees new messages when they open the tab.
 */

interface Message {
  id: number;
  created_at: string;
  author_id: string;
  author_name: string;
  body: string | null;
  photo_path: string | null;
}

const PAGE_SIZE = 200;
/** Messages from one person within this many minutes share one name-and-time label. */
const RUN_MINUTES = 5;
const MAX_PHOTO_EDGE = 1600;

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
      void syncHostsTab(client, u);
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
      <Notice title="Sign in to see the hosts' chat">
        <Link
          href="/signup"
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#dc2626] text-[17px] font-semibold text-white active:bg-[#991b1b]"
        >
          Sign in
        </Link>
      </Notice>
    );
  }
  if (!member) return <Notice title="This chat is only for the show's hosts." />;
  return <Chat client={client} user={user} timeZone={timeZone} />;
}

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
      <h1 className="text-3xl font-black tracking-tight">Hosts</h1>
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

type Client = NonNullable<ReturnType<typeof useOpenMicClient>>;

function Chat({ client, user, timeZone }: { client: Client; user: User; timeZone: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [members, setMembers] = useState<{ email: string; display_name: string }[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const add = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const byId = new Map((prev ?? []).map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
    });
  }, []);

  const loadRecent = useCallback(
    () =>
      client
        .from("host_messages")
        .select("id, created_at, author_id, author_name, body, photo_path")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE)
        .then(({ data, error: e }) => {
          if (e) return setError("Couldn't load the messages. Check your connection and try again.");
          setError("");
          add((data ?? []) as Message[]);
        }),
    [client, add]
  );

  useEffect(() => {
    void client
      .from("host_chat_members")
      .select("email, display_name")
      .order("created_at")
      .then(({ data }) => setMembers((data ?? []) as { email: string; display_name: string }[]));
    const first = setTimeout(() => void loadRecent(), 0);
    const channel = client
      .channel("host-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "host_messages" }, (payload) => add([payload.new as Message]))
      .subscribe();
    // Coming back to the tab (or the phone waking up) catches anything the live connection missed.
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadRecent();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
      void client.removeChannel(channel);
    };
  }, [client, add, loadRecent]);

  // Photos are private: fetch short-lived links for any we haven't got yet.
  useEffect(() => {
    const missing = (messages ?? []).map((m) => m.photo_path).filter((p): p is string => !!p && !photoUrls[p]);
    if (missing.length === 0) return;
    void client.storage
      .from("host-chat")
      .createSignedUrls(missing, 60 * 60 * 6)
      .then(({ data }) => {
        const next: Record<string, string> = {};
        for (const r of data ?? []) if (r.path && r.signedUrl) next[r.path] = r.signedUrl;
        setPhotoUrls((prev) => ({ ...prev, ...next }));
      });
  }, [client, messages, photoUrls]);

  // Stay at the newest message unless the reader has scrolled up to read older ones. Photos change the height
  // again when they finish loading, so the list also asks for this then.
  const scrollToNewest = useCallback(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(scrollToNewest, [messages, photoUrls, scrollToNewest]);

  const send = async (fields: { body?: string | null; photo_path?: string | null }) => {
    const { data, error: e } = await client.from("host_messages").insert(fields).select().single();
    if (e) throw e;
    stickToBottom.current = true;
    add([data as Message]);
  };

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await send({ body });
      setText("");
      setError("");
    } catch {
      setError("Your message didn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const sendPhoto = async (file: File) => {
    setSending(true);
    try {
      const blob = await shrinkPhoto(file);
      // Not crypto.randomUUID(): browsers only provide it on HTTPS pages, and the phone preview is plain HTTP.
      const path = `${user.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
      const { error: e } = await client.storage.from("host-chat").upload(path, blob, { contentType: "image/jpeg" });
      if (e) throw e;
      await send({ photo_path: path, body: text.trim() || null });
      setText("");
      setError("");
    } catch {
      setError("The photo didn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  const names = members.map((m) => m.display_name);
  const others = members.filter((m) => m.email !== user.email?.toLowerCase()).map((m) => m.display_name);
  return (
    <div className={PINNED_PAGE}>
      <header className="shrink-0">
        <h1 className="text-3xl font-black tracking-tight">Hosts</h1>
        {names.length > 0 && (
          <p className="mt-1 text-[15px] text-muted-foreground">Only {joinNames(names)} can see this chat.</p>
        )}
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2"
      >
        {messages === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-16 text-center text-[17px] text-muted-foreground">
            No messages yet.{others.length > 0 ? ` Say hi to ${joinNames(others)}.` : ""}
          </p>
        ) : (
          <MessageList messages={messages} myId={user.id} photoUrls={photoUrls} timeZone={timeZone} onPhotoLoad={scrollToNewest} />
        )}
      </div>

      {error && <p className="shrink-0 pb-2 text-center text-[15px] text-red-400">{error}</p>}

      <form
        className="flex shrink-0 items-end gap-2 border-t border-border py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void sendText();
        }}
      >
        <label
          aria-label="Send a photo"
          className={`grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground active:bg-muted ${sending ? "pointer-events-none opacity-40" : ""}`}
        >
          <ImagePlus className="h-6 w-6" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={sending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void sendPhoto(file);
            }}
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a computer; on a phone the return key adds a line and the arrow sends.
            if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) {
              e.preventDefault();
              void sendText();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Message"
          aria-label="Message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-muted px-4 py-2.5 text-[16px] leading-snug outline-none [field-sizing:content] focus:border-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={sending || !text.trim()}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#dc2626] text-white active:bg-[#991b1b] disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-6 w-6" strokeWidth={2.5} />}
        </button>
      </form>
    </div>
  );
}

function MessageList({
  messages,
  myId,
  photoUrls,
  timeZone,
  onPhotoLoad,
}: {
  messages: Message[];
  myId: string;
  photoUrls: Record<string, string>;
  timeZone: string;
  onPhotoLoad: () => void;
}) {
  const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const time = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const [now] = useState(() => Date.now());
  const today = day(new Date(now).toISOString());
  const yesterday = day(new Date(now - 86_400_000).toISOString());
  const dayLabel = (iso: string) => {
    const d = day(iso);
    if (d === today) return "Today";
    if (d === yesterday) return "Yesterday";
    return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
  };

  return (
    <ol className="flex flex-col gap-1">
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay = !prev || day(prev.created_at) !== day(m.created_at);
        const newRun =
          newDay ||
          prev.author_id !== m.author_id ||
          new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > RUN_MINUTES * 60_000;
        const mine = m.author_id === myId;
        const url = m.photo_path ? photoUrls[m.photo_path] : undefined;
        return (
          <li key={m.id} className="flex flex-col">
            {newDay && (
              <p className="my-3 text-center text-[13px] font-semibold text-muted-foreground">{dayLabel(m.created_at)}</p>
            )}
            {newRun && (
              <p className={`mb-0.5 mt-2 px-1 text-[13px] text-muted-foreground ${mine ? "text-right" : ""}`}>
                {mine ? time(m.created_at) : `${m.author_name} · ${time(m.created_at)}`}
              </p>
            )}
            <div
              className={`max-w-[80%] overflow-hidden rounded-2xl ${
                mine ? "ml-auto rounded-br-md bg-[#dc2626] text-white" : "mr-auto rounded-bl-md bg-muted text-foreground"
              }`}
            >
              {m.photo_path &&
                (url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- private signed storage link */}
                    <img src={url} alt="Photo" onLoad={onPhotoLoad} className="block max-h-80 min-h-24 w-full min-w-40 object-cover" />
                  </a>
                ) : (
                  <div className="grid h-40 w-56 place-items-center">
                    <Loader2 className="h-5 w-5 animate-spin opacity-60" />
                  </div>
                ))}
              {m.body && <p className="whitespace-pre-wrap break-words px-3.5 py-2 text-[17px] leading-snug">{m.body}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Phone photos are large; send a JPEG no bigger than MAX_PHOTO_EDGE on its long side. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}
