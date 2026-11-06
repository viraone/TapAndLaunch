"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Loader2, Lock, Send } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { syncChatTabs } from "@/lib/openmic/host-chat";
import { showDateFor } from "@/lib/openmic/window";
import { setSpotlight, ymd } from "@/lib/openmic/spotlight";
import { upNextStatus } from "@/lib/openmic/push";
import { isSpotlightCommand, planSpotlight, spotlightReply, type LineupCommand } from "@/lib/openmic/ai-commands";
import { PINNED_PAGE, PINNED_SCROLL, useLineup, useNow, useOpenMicClient, windowOf } from "./OpenMicSignupRuntime";

/**
 * StageTime's AI tab (block view "ai"), for the show's hosts only: a chat about the lineup that also previews
 * lineup changes. The server route (openmic/ai) talks to DeepSeek and checks that the caller is a host; this
 * screen only decides what to show. The transcript lives in this component's state and nowhere else.
 */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Local development only: /ai?preview=1 shows a made-up chat with no network, signed out. The check is a
// build-time constant, so production builds drop the preview screen entirely.
const PREVIEW_ENABLED = process.env.NODE_ENV !== "production";
const noopSubscribe = () => () => {};
const readPreview = () => (PREVIEW_ENABLED ? new URLSearchParams(window.location.search).has("preview") : false);

const SAMPLE: ChatMessage[] = [
  { role: "user", content: "Who's up after Jeff?" },
  { role: "assistant", content: "David is on at 8:20, right after Jeff Morris." },
  { role: "user", content: "Add Sam below Jeff" },
  {
    role: "assistant",
    content:
      "Would add Sam below Jeff Morris. Lineup editing goes live after Sunday's update, so make this change in the sheet for now.",
  },
];

export function OpenMicAiRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  const preview = useSyncExternalStore(noopSubscribe, readPreview, () => false);
  if (preview) return <AiPreview />;
  return <AiGate config={config} />;
}

/** Local only: a made-up transcript, a working text box, and a send button that does nothing. */
function AiPreview() {
  const [input, setInput] = useState("");
  return <ChatScreen messages={SAMPLE} pending={false} input={input} onInput={setInput} onSend={() => undefined} preview />;
}

/** The same host check the Votes tab makes. */
function AiGate({ config }: { config: OpenMicSignupBlockConfig }) {
  const client = useOpenMicClient(config);
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
        The AI isn&apos;t connected yet.
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
  if (!user || !member) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
        <h1 className="text-3xl font-black tracking-tight">Lineup helper</h1>
        <div className="mt-6 rounded-2xl border bg-muted/60 p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold">{user ? "The AI is for the hosts" : "Sign in to use the AI"}</h2>
          {!user && (
            <Link href="/" className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-primary/15 px-5 text-base font-bold text-primary">
              Go to Sign-Up
            </Link>
          )}
        </div>
      </div>
    );
  }
  return <Chat client={client} config={config} userId={user.id} />;
}

function Chat({ client, config, userId }: { client: SupabaseClient; config: OpenMicSignupBlockConfig; userId: string }) {
  const window_ = windowOf(config);
  const now = useNow();
  const showDate = showDateFor(window_, now);
  const showYmd = ymd(showDate);
  // The host needs the list whatever the day (a Thursday run-through, say), so this never waits for show day.
  const { feed, failed } = useLineup(config.lineup_url, client, userId, true);
  const lineup = feed?.lineup ?? [];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);

  /** The up-next push, the same call the Remote makes: the server checks the token is a host's. */
  async function pushUpNext(name: string): Promise<{ sent: number; matched: number } | null> {
    try {
      const { data } = await client.auth.getSession();
      const res = await fetch("/openmic/up-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.session?.access_token, name }),
      });
      return res.ok ? ((await res.json()) as { sent: number; matched: number }) : null;
    } catch {
      return null;
    }
  }

  /** A live on_deck or performing: move the spotlight, then buzz the comic now on deck. */
  async function applySpotlight(command: Extract<LineupCommand, { type: "on_deck" | "performing" }>): Promise<string> {
    if (!feed || failed) return "The lineup has not loaded yet. Try again in a moment.";
    const plan = planSpotlight(command, lineup);
    if (!plan.ok) return plan.text;
    const problem = await setSpotlight(client, showYmd, lineup, plan.index);
    if (problem) return "That did not save. Check the connection and try again.";
    const result = await pushUpNext(plan.name);
    return `${spotlightReply(plan)} ${upNextStatus(plan.name, result)}`;
  }

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setInput("");
    setPending(true);
    try {
      const { data } = await client.auth.getSession();
      const res = await fetch("/openmic/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.session?.access_token, messages: next.slice(-12) }),
      });
      const body = (await res.json().catch(() => ({}))) as { reply?: string; error?: string; command?: LineupCommand | null };
      if (!res.ok) {
        // The server's own words (signed out, too fast, the AI didn't answer), with the question still in the box.
        setInput(text);
        setMessages([...messages, { role: "assistant", content: typeof body.error === "string" ? body.error : "The AI didn't answer. Try again." }]);
        return;
      }
      const command = body.command ?? null;
      const content = isSpotlightCommand(command)
        ? await applySpotlight(command)
        : typeof body.reply === "string"
          ? body.reply
          : "I didn't get an answer. Try again.";
      setMessages([...next, { role: "assistant", content }]);
    } catch {
      setInput(text);
      setMessages([...messages, { role: "assistant", content: "The AI didn't answer. Try again." }]);
    } finally {
      setPending(false);
    }
  }

  return <ChatScreen messages={messages} pending={pending} input={input} onInput={setInput} onSend={() => void send()} />;
}

function ChatScreen({
  messages,
  pending,
  input,
  onInput,
  onSend,
  preview = false,
}: {
  messages: ChatMessage[];
  pending: boolean;
  input: string;
  onInput: (value: string) => void;
  onSend: () => void;
  preview?: boolean;
}) {
  return (
    <div className={PINNED_PAGE}>
      {preview && (
        <div className="mb-3 shrink-0 rounded-2xl border-2 border-dashed border-sky-400/60 bg-sky-400/10 p-3 text-sm">
          <p className="font-bold text-sky-300">PREVIEW · local only</p>
          <p className="mt-1 text-muted-foreground">A made-up chat. Nothing is sent.</p>
        </div>
      )}
      <header className="shrink-0">
        <h1 className="text-3xl font-black tracking-tight">Lineup helper</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask about the lineup. Changes are previews for now.</p>
      </header>

      <div className={`${PINNED_SCROLL} flex flex-col gap-2.5`} aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug ${
              message.role === "user" ? "ml-auto rounded-br-sm bg-primary/15" : "mr-auto rounded-bl-sm bg-muted"
            }`}
          >
            {message.content}
          </div>
        ))}

        {pending && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-[15px] text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Thinking
          </div>
        )}
      </div>

      <form
        className="shrink-0 border-t border-foreground/10 pb-1 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => onInput(event.target.value)}
            placeholder="Ask about the lineup…"
            aria-label="Message the lineup helper"
            maxLength={800}
            enterKeyHint="send"
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-xl border bg-muted px-3 text-base outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={preview || pending || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition active:scale-[0.97] disabled:opacity-40"
          >
            <Send className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
