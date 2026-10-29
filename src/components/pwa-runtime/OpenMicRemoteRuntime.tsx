"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Home, Loader2, Lock, Menu, MoreVertical, SlidersHorizontal, Tv, Undo2 } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { formatShowDate, showDateFor } from "@/lib/openmic/window";
import { setSpotlight, spotlightIndex, useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { syncChatTabs } from "@/lib/openmic/host-chat";
import { upNextStatus } from "@/lib/openmic/push";
import { useLineup, useNow, useOpenMicClient, windowOf } from "./OpenMicSignupRuntime";

/**
 * StageTime's Remote tab (block view "remote"), for the show's hosts only: the remote control for the lineup
 * board at /lineup. The host sees the lineup from the sheet, taps a comic or presses Next / Back, and that comic
 * is highlighted on the board and told on their own phone. The highlight lives in the show's database
 * (`lineup_spotlight`), so every host's remote, the board and the comics follow it at once.
 */
export function OpenMicRemoteRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
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
        The remote isn&apos;t connected yet.
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
        <h1 className="text-3xl font-black tracking-tight">Remote</h1>
        <div className="mt-6 rounded-2xl border bg-muted/60 p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold">{user ? "The remote is for the hosts" : "Sign in to use the remote"}</h2>
          {!user && (
            <Link href="/" className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-primary/15 px-5 text-base font-bold text-primary">
              Go to Sign-Up
            </Link>
          )}
        </div>
      </div>
    );
  }
  return <Remote client={client} config={config} userId={user.id} />;
}

function Remote({ client, config, userId }: { client: NonNullable<ReturnType<typeof useOpenMicClient>>; config: OpenMicSignupBlockConfig; userId: string }) {
  const window_ = windowOf(config);
  const now = useNow();
  const showDate = showDateFor(window_, now);
  const showYmd = ymd(showDate);
  // The host needs the list whatever the day (a Thursday run-through, say), so this never waits for show day.
  const { feed, failed } = useLineup(config.lineup_url, client, userId, true);
  const { spotlight } = useSpotlight(client);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What happened on the highlighted comic's phone after the last move. */
  const [told, setTold] = useState<string | null>(null);
  /** The lineup list in the tray under the pad, folded away by default so the pad has the screen. */
  const [listOpen, setListOpen] = useState(false);

  const lineup = feed?.lineup ?? [];
  const current = spotlightIndex(spotlight, lineup, showYmd);

  async function move(index: number) {
    if (saving) return;
    setSaving(true);
    setError(null);
    const problem = await setSpotlight(client, showYmd, lineup, index);
    setSaving(false);
    if (problem) return setError("That didn't save. Check the connection and try again.");
    const entry = index >= 0 ? lineup[index] : undefined;
    setTold(null);
    if (entry) void tell(entry.name);
  }

  // The board and open phones follow the spotlight by themselves; a closed phone needs a push, sent by the server
  // once it has checked this is a host. The line under the buttons says whether a phone was reached.
  async function tell(name: string) {
    try {
      const { data } = await client.auth.getSession();
      const res = await fetch("/openmic/up-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.session?.access_token, name }),
      });
      const result = res.ok ? ((await res.json()) as { sent: number; matched: number }) : null;
      setTold(upNextStatus(name, result));
    } catch {
      setTold(upNextStatus(name, null));
    }
  }

  const next = () => void move(Math.min(current + 1, lineup.length - 1));
  const back = () => void move(current - 1);
  const canBack = !saving && current >= 0;
  const canNext = !saving && lineup.length > 0 && current < lineup.length - 1;
  const onName = current >= 0 ? lineup[current]!.name : "Nobody";

  return (
    <div className="mx-auto w-full max-w-md px-3 pb-10 pt-3">
      {/* The remote itself: one dark slab like a TV remote app, the pad in the middle. */}
      <div className="rounded-[2rem] bg-[#262626] px-4 pb-5 pt-3 text-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
        <div className="mx-auto h-1.5 w-20 rounded-full bg-white/15" aria-hidden="true" />
        <div className="mt-4 flex items-center justify-between">
          <span className="w-10" aria-hidden="true" />
          <p className="flex items-center gap-2 text-[17px] font-semibold text-sky-400">
            <Tv className="h-4 w-4" aria-hidden="true" />
            Lineup board
          </p>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            aria-label={listOpen ? "Hide the lineup" : "Show the lineup"}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 active:bg-white/10"
          >
            <MoreVertical className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* What the pad is pointing at: the highlighted comic, the one the board shows solid. */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-label="Lineup list"
            className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          >
            <Menu className="h-7 w-7" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/50">Highlighted now</p>
            <p className="mt-0.5 truncate text-2xl font-black leading-tight">{onName}</p>
            <p className="min-h-5 text-sm text-white/55">
              {current >= 0 ? `${current + 1} of ${lineup.length}${lineup[current]!.start_time ? ` · ${lineup[current]!.start_time}` : ""}` : lineup.length > 0 ? `${lineup.length} on the lineup` : ""}
            </p>
          </div>
          <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-white/10" aria-hidden="true">
            {saving ? <Loader2 className="h-7 w-7 animate-spin" /> : <SlidersHorizontal className="h-7 w-7 text-white/70" />}
          </div>
        </div>

        {/* The pad: Left/Up = back one, Right/Down = next, the centre buzzes the highlighted comic again. */}
        <div className="relative mx-auto mt-6 aspect-square w-full max-w-[21rem]">
          <div className="absolute inset-0 overflow-hidden rounded-full bg-[#1a1a1a] ring-1 ring-white/10">
            <PadButton side="top" onClick={back} disabled={!canBack} label="Back one">
              <ChevronUp className={PAD_ICON} strokeWidth={2.25} aria-hidden="true" />
            </PadButton>
            <PadButton side="bottom" onClick={next} disabled={!canNext} label="Next">
              <ChevronDown className={PAD_ICON} strokeWidth={2.25} aria-hidden="true" />
            </PadButton>
            <PadButton side="left" onClick={back} disabled={!canBack} label="Back one">
              <ChevronLeft className={PAD_ICON} strokeWidth={2.25} aria-hidden="true" />
            </PadButton>
            <PadButton side="right" onClick={next} disabled={!canNext} label="Next">
              <ChevronRight className={PAD_ICON} strokeWidth={2.25} aria-hidden="true" />
            </PadButton>
            {/* The thin gaps between the four keys. */}
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rotate-45 bg-[#262626]" aria-hidden="true" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 -rotate-45 bg-[#262626]" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={() => current >= 0 && void tell(lineup[current]!.name)}
            disabled={saving || current < 0}
            aria-label={current >= 0 ? `Buzz ${onName}'s phone again` : "Nobody highlighted"}
            className="absolute left-1/2 top-1/2 flex h-[44%] w-[44%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#3a3a3a] text-center ring-[6px] ring-[#262626] active:bg-[#4a4a4a] disabled:active:bg-[#3a3a3a]"
          >
            <span className="px-3 text-[13px] font-bold uppercase tracking-[0.2em] text-white/60">{current >= 0 ? "Buzz" : ""}</span>
          </button>
        </div>

        {/* Bottom row, like the remote: back (one step) on the left, the orange home key clears the highlight. */}
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            disabled={!canBack}
            aria-label="Back one"
            className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white/10 active:bg-white/20 disabled:opacity-40"
          >
            <Undo2 className="h-7 w-7" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void move(-1)}
            disabled={saving || current < 0}
            aria-label="Clear the highlight"
            className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#ff5a1f] text-white shadow-[0_10px_30px_-10px_#ff5a1f] active:bg-[#ff7a45] disabled:opacity-40 disabled:shadow-none"
          >
            <Home className="h-8 w-8" aria-hidden="true" />
          </button>
        </div>

        <div className="mx-auto mt-5 h-1 w-6 rounded-full bg-white/20" aria-hidden="true" />

        {/* The tray under the pad: the lineup, with the highlighted comic's row lit. */}
        <div className="mt-3 rounded-2xl bg-[#1f1f1f] ring-1 ring-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-[15px] font-semibold">{listOpen ? "Lineup" : formatShowDate(showDate)}</p>
            <p className="text-sm text-white/55" aria-live="polite">
              {error ? <span className="font-semibold text-red-400">{error}</span> : told ?? (lineup.length > 0 ? `${lineup.length} comics` : "")}
            </p>
          </div>
          {!feed && !failed && (
            <div className="flex justify-center py-8" role="status" aria-label="Loading the lineup">
              <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            </div>
          )}
          {!feed && failed && <p className="px-4 pb-5 text-center text-base text-white/60">We couldn&apos;t load the lineup. Try again in a minute.</p>}
          {feed && lineup.length === 0 && <p className="px-4 pb-5 text-center text-base text-white/60">Nobody is on the lineup in the sheet yet.</p>}
          {lineup.length > 0 && listOpen && (
            <ol className="border-t border-white/10" aria-label="Lineup">
              {lineup.map((entry, i) => {
                const on = i === current;
                return (
                  <li key={`${entry.name}-${i}`} className="relative after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-white/10 last:after:hidden">
                    <button
                      type="button"
                      onClick={() => void move(on ? -1 : i)}
                      aria-pressed={on}
                      className={
                        "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left last:rounded-b-2xl" +
                        (on ? " bg-primary text-primary-foreground" : " active:bg-white/10")
                      }
                    >
                      <span className={"w-7 shrink-0 text-right text-[15px] font-bold tabular-nums " + (on ? "" : "text-white/50")}>{i + 1}</span>
                      <span className={"min-w-0 flex-1 break-words text-[17px] leading-snug " + (on ? "font-black" : "font-medium")}>{entry.name}</span>
                      <span className={"shrink-0 text-[15px] tabular-nums " + (on ? "" : "text-white/50")}>{entry.set_length}</span>
                      <span className={"w-[4.75rem] shrink-0 text-right text-[16px] font-semibold tabular-nums " + (on ? "" : "text-primary")}>{entry.start_time}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

const PAD_ICON = "h-9 w-9";

/** One of the four keys of the pad: a quarter of the circle, cut with a clip-path, the arrow near the rim. */
function PadButton({ side, onClick, disabled, label, children }: { side: "top" | "bottom" | "left" | "right"; onClick: () => void; disabled: boolean; label: string; children: ReactNode }) {
  const clip = {
    top: "polygon(0 0, 100% 0, 50% 50%)",
    bottom: "polygon(0 100%, 100% 100%, 50% 50%)",
    left: "polygon(0 0, 50% 50%, 0 100%)",
    right: "polygon(100% 0, 50% 50%, 100% 100%)",
  }[side];
  const place = {
    top: "items-start justify-center pt-5",
    bottom: "items-end justify-center pb-5",
    left: "items-center justify-start pl-5",
    right: "items-center justify-end pr-5",
  }[side];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{ clipPath: clip }}
      className={`absolute inset-0 flex text-white/85 active:bg-white/10 disabled:text-white/25 ${place}`}
    >
      {children}
    </button>
  );
}
