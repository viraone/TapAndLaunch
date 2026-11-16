"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Loader2, Lock, Tv } from "lucide-react";
import { toast } from "sonner";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { showDateFor } from "@/lib/openmic/window";
import { isShowAdmin, useSpotlight, ymd } from "@/lib/openmic/spotlight";
import { applyComicMinutes, comicMinutes, eachMinutes, nameKey, setComicMinutes, setEachMinutes } from "@/lib/openmic/set-minutes";
import { setMinutes } from "@/lib/openmic/start-times";
import { CompSetPicker } from "./CompSetPicker";
import { SavedFlash } from "./SavedFlash";
import { RestartShowButton } from "./RestartShowButton";
import { hapticSuccess } from "@/lib/haptics";
import { resetClock } from "@/lib/openmic/show-clock-actions";
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
  const { feed: sheetFeed } = useLineup(config.lineup_url, client, userId, true);
  const { spotlight } = useSpotlight(client);
  const feed = useMemo(() => applyComicMinutes(sheetFeed, spotlight, config.host_row === true), [sheetFeed, spotlight, config.host_row]);
  const [saving, setSaving] = useState(false);
  const [lengthError, setLengthError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: number; text: string } | null>(null);
  const [target, setTarget] = useState("");
  const clearSaved = useCallback(() => setSaved(null), [setSaved]);

  const lineup = feed?.lineup ?? [];

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

  async function changeMinutes(minutes: number | null): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    setLengthError(null);
    const who = pickedTarget ? pickedTarget.name : "everyone";
    const problem = pickedTarget
      ? await setEachMinutes(client, lengthDate, each, pickedTarget.name, minutes)
      : await setComicMinutes(client, lengthDate, minutes);
    setSaving(false);
    if (problem) {
      setLengthError("That didn't save. Check the connection and try again.");
      toast.error("That didn't save. Try again.");
      return false;
    }
    setSaved({ id: Date.now(), text: minutes === null ? (pickedTarget ? `${who} is back to the same as everyone` : "Back to the sheet's lengths") : `Set ${who} to ${minutes} min` });
    hapticSuccess();
    return true;
  }

  async function restartShow() {
    if (saving) return;
    setSaving(true);
    const problem = await resetClock(client, showYmd);
    setSaving(false);
    if (problem) return void toast.error("That didn't save. Check the connection and try again.");
    toast.success("Show restarted");
  }
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
          <span className="flex w-10 justify-end">{saving ? <Loader2 className="h-5 w-5 animate-spin text-white/70" aria-hidden="true" /> : null}</span>
        </div>
        <CompSetPicker targets={targets} selected={pickedTarget ? pickedTarget.key : ""} onSelect={setTarget} allMinutes={dictated} fallback={sheetMinutes} hasOverrides={dictated !== null || Object.keys(each).length > 0} saving={saving} error={lengthError} onChange={(minutes) => changeMinutes(minutes)} />
        {saved && <SavedFlash key={saved.id} message={saved.text} onDone={clearSaved} />}

        {isShowAdmin(viewerEmail) && <RestartShowButton busy={saving} onRestart={() => void restartShow()} />}
      </div>
    </div>
  );
}
