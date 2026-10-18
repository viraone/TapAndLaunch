"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ArrowUp, ImagePlus, Loader2 } from "lucide-react";

/**
 * One chat thread (messages, photos, composer), shared by StageTime's Hosts tab (the hosts' group chat and each
 * comedian's thread as the hosts see it) and the comedians' "Message the Hosts" tab. Which table and rows, which
 * bucket, and which messages count as "mine" come from the `source`. Who may read or post is the database's
 * decision (its access rules); this only draws.
 *
 * Renders the scroller and the composer as siblings: put it inside a flex column (PINNED_PAGE) with the header
 * above it.
 */

export interface ThreadMessage {
  id: number;
  created_at: string;
  author_id: string;
  author_name: string;
  body: string | null;
  photo_path: string | null;
  /** comedian_messages only. */
  from_host?: boolean;
}

export interface ThreadSource {
  table: "host_messages" | "comedian_messages";
  /** Column = value filters for the query and the live updates (one thread). */
  match?: Record<string, string>;
  /** Columns added to every message sent from here (e.g. the thread's comedian_id). */
  insert?: Record<string, string>;
  bucket: "host-chat" | "comedian-chat";
  /** The folder photos go in, inside the bucket. */
  folder: string;
  /** Messages shown on the right, in red: the reader's own side. */
  mine: (m: ThreadMessage, me: User) => boolean;
  emptyText: string;
  /** Called with the newest message while the thread is on screen, to mark it read. */
  onSeen?: (latest: ThreadMessage) => void;
}

const PAGE_SIZE = 200;
/** Messages from one person within this many minutes share one name-and-time label. */
const RUN_MINUTES = 5;
const MAX_PHOTO_EDGE = 1600;

export function ChatThread({ client, user, timeZone, source }: { client: SupabaseClient; user: User; timeZone: string; source: ThreadSource }) {
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const matchKey = JSON.stringify(source.match ?? {});
  // The latest onSeen, read from the effect below without re-running it on every render.
  const onSeen = useRef(source.onSeen);
  useEffect(() => {
    onSeen.current = source.onSeen;
  });

  const add = useCallback((incoming: ThreadMessage[]) => {
    setMessages((prev) => {
      const byId = new Map((prev ?? []).map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
    });
  }, []);

  const loadRecent = useCallback(
    () =>
      client
        .from(source.table)
        .select("*")
        .match(JSON.parse(matchKey) as Record<string, string>)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE)
        .then(({ data, error: e }) => {
          if (e) return setError("Couldn't load the messages. Check your connection and try again.");
          setError("");
          add((data ?? []) as ThreadMessage[]);
        }),
    [client, source.table, matchKey, add]
  );

  // One ChatThread shows one thread: parents key it by thread, so a different thread mounts afresh.
  useEffect(() => {
    const first = setTimeout(() => void loadRecent(), 0);
    const match = JSON.parse(matchKey) as Record<string, string>;
    const [filterKey, filterValue] = Object.entries(match)[0] ?? [];
    const channel = client
      .channel(`${source.table}-${source.folder}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: source.table, ...(filterKey ? { filter: `${filterKey}=eq.${filterValue}` } : {}) },
        (payload) => add([payload.new as ThreadMessage])
      )
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
  }, [client, source.table, source.folder, matchKey, add, loadRecent]);

  // Photos are private: fetch short-lived links for any we haven't got yet.
  useEffect(() => {
    const missing = (messages ?? []).map((m) => m.photo_path).filter((p): p is string => !!p && !photoUrls[p]);
    if (missing.length === 0) return;
    void client.storage
      .from(source.bucket)
      .createSignedUrls(missing, 60 * 60 * 6)
      .then(({ data }) => {
        const next: Record<string, string> = {};
        for (const r of data ?? []) if (r.path && r.signedUrl) next[r.path] = r.signedUrl;
        setPhotoUrls((prev) => ({ ...prev, ...next }));
      });
  }, [client, source.bucket, messages, photoUrls]);

  // Stay at the newest message unless the reader has scrolled up to read older ones. Photos change the height
  // again when they finish loading, so the list also asks for this then.
  const scrollToNewest = useCallback(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(scrollToNewest, [messages, photoUrls, scrollToNewest]);

  // The newest message counts as seen while the thread is on screen.
  useEffect(() => {
    const latest = messages?.[messages.length - 1];
    if (!latest || !onSeen.current) return;
    const tell = () => {
      if (document.visibilityState === "visible") onSeen.current?.(latest);
    };
    tell();
    document.addEventListener("visibilitychange", tell);
    return () => document.removeEventListener("visibilitychange", tell);
  }, [messages]);

  const send = async (fields: { body?: string | null; photo_path?: string | null }) => {
    const { data, error: e } = await client
      .from(source.table)
      .insert({ ...(source.insert ?? {}), ...fields })
      .select()
      .single();
    if (e) throw e;
    stickToBottom.current = true;
    add([data as ThreadMessage]);
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
      const path = `${source.folder}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.jpg`;
      const { error: e } = await client.storage.from(source.bucket).upload(path, blob, { contentType: "image/jpeg" });
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

  return (
    <>
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
          <p className="text-balance px-6 py-16 text-center text-[17px] text-muted-foreground">{source.emptyText}</p>
        ) : (
          <MessageList messages={messages} mine={(m) => source.mine(m, user)} photoUrls={photoUrls} timeZone={timeZone} onPhotoLoad={scrollToNewest} />
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
    </>
  );
}

function MessageList({
  messages,
  mine,
  photoUrls,
  timeZone,
  onPhotoLoad,
}: {
  messages: ThreadMessage[];
  mine: (m: ThreadMessage) => boolean;
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
        const own = mine(m);
        const url = m.photo_path ? photoUrls[m.photo_path] : undefined;
        return (
          <li key={m.id} className="flex flex-col">
            {newDay && <p className="my-3 text-center text-[13px] font-semibold text-muted-foreground">{dayLabel(m.created_at)}</p>}
            {newRun && (
              <p className={`mb-0.5 mt-2 px-1 text-[13px] text-muted-foreground ${own ? "text-right" : ""}`}>
                {own ? time(m.created_at) : `${m.author_name} · ${time(m.created_at)}`}
              </p>
            )}
            <div
              className={`max-w-[80%] overflow-hidden rounded-2xl ${
                own ? "ml-auto rounded-br-md bg-[#dc2626] text-white" : "mr-auto rounded-bl-md bg-muted text-foreground"
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

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** Remember how far this reader has read a comedian's thread (hosts' unread counts; the comedian's own mark too). */
export function markThreadRead(client: SupabaseClient, readerId: string, comedianId: string, latest: ThreadMessage): void {
  void client
    .from("comedian_thread_reads")
    .upsert({ reader_id: readerId, comedian_id: comedianId, read_at: latest.created_at }, { onConflict: "reader_id,comedian_id" })
    .then(({ error }) => {
      if (error) console.warn("Could not save the read mark:", error.message);
    });
}
