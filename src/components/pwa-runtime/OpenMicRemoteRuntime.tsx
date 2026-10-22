"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { formatShowDate, showDateFor } from "@/lib/openmic/window";
import { setSpotlight, spotlightIndex, useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { syncChatTabs } from "@/lib/openmic/host-chat";
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

  const lineup = feed?.lineup ?? [];
  const current = spotlightIndex(spotlight, lineup, showYmd);

  async function move(index: number) {
    if (saving) return;
    setSaving(true);
    setError(null);
    const problem = await setSpotlight(client, showYmd, lineup, index);
    setSaving(false);
    if (problem) setError("That didn't save. Check the connection and try again.");
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
      <h1 className="text-3xl font-black tracking-tight">Remote</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Highlights a comic on the lineup screen and tells them on their phone. {formatShowDate(showDate)}.
      </p>

      {/* The buttons sit above the list so a thumb can reach them without scrolling. */}
      <div className="sticky top-0 z-10 -mx-4 mt-5 bg-background px-4 pb-3 pt-2">
        <div className="rounded-2xl border bg-muted/60 p-4">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">Highlighted now</p>
          <p className="mt-1 min-h-8 truncate text-2xl font-black">{current >= 0 ? lineup[current]!.name : "Nobody"}</p>
          {current >= 0 && (
            <p className="text-sm text-muted-foreground">
              {current + 1} of {lineup.length}
              {lineup[current]!.start_time ? ` · ${lineup[current]!.start_time}` : ""}
              {spotlight?.set_by ? ` · set by ${spotlight.set_by}` : ""}
            </p>
          )}
          <div className="mt-4 grid grid-cols-[1fr_2fr] gap-3">
            <button
              type="button"
              onClick={() => void move(current - 1)}
              disabled={saving || current < 0}
              aria-label="Back"
              className="flex h-16 items-center justify-center rounded-xl bg-foreground/10 text-lg font-bold disabled:opacity-40"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
              Back
            </button>
            <button
              type="button"
              onClick={() => void move(Math.min(current + 1, lineup.length - 1))}
              disabled={saving || lineup.length === 0 || current >= lineup.length - 1}
              className="flex h-16 items-center justify-center rounded-xl bg-[#dc2626] text-xl font-bold text-white disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void move(-1)}
            disabled={saving || current < 0}
            className="mt-3 h-11 w-full rounded-xl text-base font-semibold text-muted-foreground disabled:opacity-40"
          >
            Clear the highlight
          </button>
          {error && <p className="mt-2 text-sm font-semibold text-red-400">{error}</p>}
        </div>
      </div>

      {!feed && !failed && (
        <div className="flex justify-center py-12" role="status" aria-label="Loading the lineup">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {!feed && failed && (
        <p className="rounded-2xl border bg-muted/60 p-6 text-center text-base text-muted-foreground">We couldn&apos;t load the lineup. Try again in a minute.</p>
      )}
      {feed && lineup.length === 0 && (
        <p className="rounded-2xl border bg-muted/60 p-6 text-center text-base text-muted-foreground">Nobody is on the lineup in the sheet yet.</p>
      )}
      {lineup.length > 0 && (
        <ol className="mt-2 rounded-xl bg-muted" aria-label="Lineup">
          {lineup.map((entry, i) => {
            const on = i === current;
            return (
              <li key={`${entry.name}-${i}`} className="relative after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-foreground/10 last:after:hidden">
                <button
                  type="button"
                  onClick={() => void move(on ? -1 : i)}
                  aria-pressed={on}
                  className={
                    "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left first:rounded-t-xl last:rounded-b-xl" +
                    (on ? " bg-primary text-primary-foreground" : " active:bg-foreground/10")
                  }
                >
                  <span className={"w-7 shrink-0 text-right text-[15px] font-bold tabular-nums " + (on ? "" : "text-muted-foreground")}>{i + 1}</span>
                  <span className={"min-w-0 flex-1 break-words text-[17px] leading-snug " + (on ? "font-black" : "font-medium")}>{entry.name}</span>
                  <span className={"shrink-0 text-[15px] tabular-nums " + (on ? "" : "text-muted-foreground")}>{entry.set_length}</span>
                  <span className={"w-[4.75rem] shrink-0 text-right text-[16px] font-semibold tabular-nums " + (on ? "" : "text-primary")}>{entry.start_time}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
