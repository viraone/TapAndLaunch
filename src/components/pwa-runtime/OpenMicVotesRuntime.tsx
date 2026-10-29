"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Loader2, Lock } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { syncChatTabs } from "@/lib/openmic/host-chat";
import type { VoteResults } from "@/lib/openmic/votes";
import { useOpenMicClient } from "./OpenMicSignupRuntime";

/** How often the page asks the server for a fresh copy of the tally. */
const REFRESH_MS = 15_000;

/**
 * StageTime's Tally tab (block view "votes"), for the show's hosts only: the costume contest's winner and ranked
 * tally. The count is done in the host's Google Sheet (first vote per ballot ID, unknown IDs ignored); this page
 * shows the sheet's published "Tally" tab, refreshed every few seconds. The server route decides who may read it.
 */
export function OpenMicVotesRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
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
        The vote tally isn&apos;t connected yet.
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
        <h1 className="text-3xl font-black tracking-tight">Tally</h1>
        <div className="mt-6 rounded-2xl border bg-muted/60 p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold">{user ? "The tally is for the hosts" : "Sign in to see the tally"}</h2>
          {!user && (
            <Link href="/" className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-primary/15 px-5 text-base font-bold text-primary">
              Go to Sign-Up
            </Link>
          )}
        </div>
      </div>
    );
  }
  return <Votes client={client} />;
}

type Status = { kind: "loading" } | { kind: "ok"; results: VoteResults; at: Date } | { kind: "denied" } | { kind: "failed"; had?: { results: VoteResults; at: Date } };

function Votes({ client }: { client: NonNullable<ReturnType<typeof useOpenMicClient>> }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const { data } = await client.auth.getSession();
      const res = await fetch("/openmic/vote-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.session?.access_token }),
      });
      if (res.status === 403) return setStatus({ kind: "denied" });
      if (!res.ok) return setStatus((s) => ({ kind: "failed", had: s.kind === "ok" ? s : s.kind === "failed" ? s.had : undefined }));
      const body = (await res.json()) as { results: VoteResults };
      setStatus({ kind: "ok", results: body.results, at: new Date() });
    } catch {
      setStatus((s) => ({ kind: "failed", had: s.kind === "ok" ? s : s.kind === "failed" ? s.had : undefined }));
    }
  }, [client]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const shown = status.kind === "ok" ? status : status.kind === "failed" ? status.had : undefined;

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
      <h1 className="text-3xl font-black tracking-tight">Tally</h1>
      <p className="mt-1 text-base text-muted-foreground">Best costume. Each ballot counts once, its first vote.</p>

      {status.kind === "loading" && (
        <div className="flex justify-center py-12" role="status" aria-label="Loading the tally">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {status.kind === "denied" && (
        <p className="mt-6 rounded-2xl border bg-muted/60 p-6 text-center text-base text-muted-foreground">This page is only for the person running the contest.</p>
      )}
      {status.kind === "failed" && !shown && (
        <p className="mt-6 rounded-2xl border bg-muted/60 p-6 text-center text-base text-muted-foreground">We couldn&apos;t load the tally. Trying again in a few seconds.</p>
      )}
      {shown && <Tally results={shown.results} at={shown.at} stale={status.kind === "failed"} />}
    </div>
  );
}

function Tally({ results, at, stale }: { results: VoteResults; at: Date; stale: boolean }) {
  const top = Math.max(1, ...results.rows.map((r) => r.votes));
  return (
    <>
      {results.warning && <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm font-semibold text-red-400">{results.warning}</p>}

      <div className="mt-5 rounded-2xl border bg-muted/60 p-4">
        <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">Winner</p>
        <p className="mt-1 break-words text-2xl font-black">{results.winner || "No valid votes yet"}</p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-center">
        <Stat label="Valid votes" value={results.valid} strong />
        <Stat label="Total submitted" value={results.total} />
        <Stat label="Duplicates ignored" value={results.duplicates} />
        <Stat label="Invalid IDs ignored" value={results.invalid} />
      </dl>

      <ol className="mt-5 rounded-xl bg-muted" aria-label="Ranking">
        {results.rows.map((row) => (
          <li key={row.name} className="relative px-4 py-3 after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-foreground/10 last:after:hidden">
            <div className="flex items-baseline gap-3">
              <span className="w-6 shrink-0 text-right text-[15px] font-bold tabular-nums text-muted-foreground">{row.rank}</span>
              <span className="min-w-0 flex-1 break-words text-[17px] font-semibold leading-snug">{row.name}</span>
              <span className="shrink-0 text-[17px] font-black tabular-nums">{row.votes}</span>
              <span className="w-12 shrink-0 text-right text-[14px] tabular-nums text-muted-foreground">{Math.round(row.share * 100)}%</span>
            </div>
            <div className="ml-9 mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(row.votes / top) * 100}%` }} />
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-center text-sm text-muted-foreground" aria-live="polite">
        {stale ? "Couldn't refresh. Showing the last copy from " : "Updated "}
        {at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}. Google can take a few minutes to publish new votes. The Google Sheet itself is always current.
      </p>
    </>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <dd className={"tabular-nums " + (strong ? "text-3xl font-black" : "text-2xl font-bold")}>{value}</dd>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
    </div>
  );
}
