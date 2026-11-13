"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Home, Loader2, Lock, Menu, MoreVertical, SlidersHorizontal, Tv, Undo2 } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { formatShowDate, showDateFor } from "@/lib/openmic/window";
import { isShowAdmin, setSpotlight, spotlightIndex, useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { applyComicMinutes, comicMinutes, eachMinutes, nameKey, setComicMinutes, setEachMinutes } from "@/lib/openmic/set-minutes";
import { setMinutes } from "@/lib/openmic/start-times";
import { CompSetPicker } from "./CompSetPicker";
import { RestartShowButton } from "./RestartShowButton";
import { resetClock } from "@/lib/openmic/show-clock-actions";
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
        <h1 className="text-3xl font-black tracking-tight">Timer</h1>
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
  return <Remote client={client} config={config} userId={user.id} viewerEmail={user.email ?? null} />;
}

function Remote({ client, config, userId, viewerEmail }: { client: NonNullable<ReturnType<typeof useOpenMicClient>>; config: OpenMicSignupBlockConfig; userId: string; viewerEmail: string | null }) {
  const window_ = windowOf(config);
  const now = useNow();
  const showDate = showDateFor(window_, now);
  const showYmd = ymd(showDate);
  // The host needs the list whatever the day (a Thursday run-through, say), so this never waits for show day.
  const { feed: sheetFeed, failed } = useLineup(config.lineup_url, client, userId, true);
  const { spotlight } = useSpotlight(client);
  const feed = useMemo(() => applyComicMinutes(sheetFeed, spotlight, config.host_row === true), [sheetFeed, spotlight, config.host_row]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What happened on the highlighted comic's phone after the last move. */
  const [told, setTold] = useState<string | null>(null);
  /** The lineup list in the tray under the keys, folded away by default. */
  const [listOpen, setListOpen] = useState(false);
  const [lengthError, setLengthError] = useState<string | null>(null);
  const [target, setTarget] = useState("");

  const lineup = feed?.lineup ?? [];
  const current = spotlightIndex(spotlight, lineup, showYmd);

  // The hosts' one number for every comic. It is stored against the sheet's show date so the feed and this page agree.
  const lengthDate = sheetFeed?.show_date ?? showYmd;
  const dictated = comicMinutes(spotlight, lengthDate);
  const each = eachMinutes(spotlight, lengthDate);
  const sheetMinutes = setMinutes(sheetFeed?.lineup[config.host_row === true ? 1 : 0]?.set_length ?? "");
  // Everyone but the hosts row, each with the number they have right now (the feed already carries the hosts' numbers).
  const targets = lineup
    .slice(config.host_row === true ? 1 : 0)
    .map((entry) => ({ key: nameKey(entry.name), name: entry.name, minutes: setMinutes(entry.set_length), custom: nameKey(entry.name) in each }));
  const pickedTarget = targets.find((t) => t.key === target) ?? null;

  async function changeMinutes(minutes: number | null) {
    if (saving) return;
    setSaving(true);
    setLengthError(null);
    const problem = pickedTarget
      ? await setEachMinutes(client, lengthDate, each, pickedTarget.name, minutes)
      : await setComicMinutes(client, lengthDate, minutes);
    setSaving(false);
    if (problem) setLengthError("That didn't save. Check the connection and try again.");
  }

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

  const back = () => void move(current - 1);
  const canBack = !saving && current >= 0;
  async function restartShow() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const problem = await resetClock(client, showYmd);
    setSaving(false);
    if (problem) return setError("That didn't save. Check the connection and try again.");
    setTold("Show restarted");
  }
  const onName = current >= 0 ? lineup[current]!.name : "Nobody";

  return (
    <div className="mx-auto w-full max-w-md px-3 pb-10 pt-3">
      {/* The remote itself: one dark slab like a TV remote app. */}
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,#2c2c2c_0%,#232323_55%,#1d1d1d_100%)] px-4 pb-5 pt-3 text-white shadow-[0_34px_80px_-30px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-white/[0.08]">
        <div className="mx-auto h-1.5 w-20 rounded-full bg-white/[0.13] shadow-[inset_0_1px_1px_rgba(0,0,0,0.5)]" aria-hidden="true" />
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
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition active:scale-95 active:bg-white/10"
          >
            <MoreVertical className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <CompSetPicker targets={targets} selected={pickedTarget ? pickedTarget.key : ""} onSelect={setTarget} allMinutes={dictated} fallback={sheetMinutes} hasOverrides={dictated !== null || Object.keys(each).length > 0} saving={saving} error={lengthError} onChange={(minutes) => void changeMinutes(minutes)} />

        {/* The highlighted comic, the one the board shows solid. */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-label="Lineup list"
            className={ROUND_KEY}
          >
            <Menu className="h-7 w-7" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">Highlighted now</p>
            <p className="mt-0.5 line-clamp-2 break-words text-[22px] font-black leading-tight tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]">{onName}</p>
            <p className="min-h-5 text-sm font-medium tabular-nums text-white/50">
              {current >= 0 ? `${current + 1} of ${lineup.length}${lineup[current]!.start_time ? ` · ${lineup[current]!.start_time}` : ""}` : lineup.length > 0 ? `${lineup.length} on the lineup` : ""}
            </p>
          </div>
          <div className={`${ROUND_KEY_LOOK} h-[4.5rem] w-[4.5rem] shrink-0`} aria-hidden="true">
            {saving ? <Loader2 className="h-7 w-7 animate-spin" /> : <SlidersHorizontal className="h-7 w-7 text-white/70" />}
          </div>
        </div>

        {/* Bottom row, like the remote: back (one step) on the left, the orange home key clears the highlight. */}
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={back}
            disabled={!canBack}
            aria-label="Back one"
            className={`${ROUND_KEY} disabled:opacity-40`}
          >
            <Undo2 className="h-7 w-7" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void move(-1)}
            disabled={saving || current < 0}
            aria-label="Clear the highlight"
            className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_28%,#ff7a45_0%,#ff5a1f_55%,#e94c15_100%)] text-white shadow-[0_14px_34px_-10px_rgba(255,90,31,0.75),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-2px_6px_rgba(0,0,0,0.25)] transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
          >
            <Home className="h-8 w-8" aria-hidden="true" />
          </button>
        </div>

        <div className="mx-auto mt-5 h-1 w-6 rounded-full bg-white/[0.18]" aria-hidden="true" />

        {/* The tray under the keys: the lineup, with the highlighted comic's row lit. */}
        <div className="mt-3 rounded-2xl bg-[linear-gradient(180deg,#242424,#1b1b1b)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.08]">
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
        {isShowAdmin(viewerEmail) && <RestartShowButton busy={saving} onRestart={() => void restartShow()} />}
      </div>
    </div>
  );
}

/** The round keys beside the name and in the bottom row: a soft bevel, lit from the top, pressed in on tap. */
const ROUND_KEY_LOOK = "flex items-center justify-center rounded-full bg-[linear-gradient(180deg,#3a3a3a,#2a2a2a)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_18px_-10px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06]";
const ROUND_KEY = `${ROUND_KEY_LOOK} h-[4.5rem] w-[4.5rem] shrink-0 transition active:scale-95 active:bg-[linear-gradient(180deg,#2a2a2a,#222)]`;
