"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Loader2, UserRound } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { initialsOf, profileOf, useOpenMicClient } from "./OpenMicSignupRuntime";

/**
 * StageTime's Profile tab: who is signed in (stage name, Instagram, email) and the Sign Out
 * button, which used to sit in the Sign-Up page's account row. It reads the same sign-in as the
 * Sign-Up tab (same Supabase project and storage key), so signing out here signs out there too.
 */

// Local development only: /profile?preview=signed-in or ?preview=signed-out shows the screen
// with a made-up comic. A build-time constant, so production builds drop it.
const PREVIEW_ENABLED = process.env.NODE_ENV !== "production";
const noopSubscribe = () => () => {};
const readPreview = () => (PREVIEW_ENABLED ? new URLSearchParams(window.location.search).get("preview") : null);

const PREVIEW_COMIC = { stage_name: "Lori Peck", instagram: "@loripeck", email: "lori@example.com" };

export function OpenMicProfileRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  const preview = useSyncExternalStore(noopSubscribe, readPreview, () => null);
  if (PREVIEW_ENABLED && preview === "signed-in") {
    return <ProfileScreen comic={PREVIEW_COMIC} onSignOut={() => (window.location.search = "?preview=signed-out")} />;
  }
  if (PREVIEW_ENABLED && preview === "signed-out") return <ProfileScreen comic={null} />;
  return <OpenMicProfileLive config={config} />;
}

function OpenMicProfileLive({ config }: { config: OpenMicSignupBlockConfig }) {
  const client = useOpenMicClient(config);
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    void client.auth.getSession().then(({ data }) => {
      if (!cancelled) setUser(data.session?.user ?? null);
    });
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
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
  if (user === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <ProfileScreen comic={null} />;
  const p = profileOf(user);
  return (
    <ProfileScreen
      comic={{ stage_name: p.stage_name, instagram: p.instagram, email: user.email ?? "" }}
      onSignOut={() => void client.auth.signOut()}
    />
  );
}

interface Comic {
  stage_name: string;
  instagram: string;
  email: string;
}

/** The screen itself, iOS Settings style: a large avatar and name, an inset grouped list, and Sign Out in its own row. */
function ProfileScreen({ comic, onSignOut }: { comic: Comic | null; onSignOut?: () => void }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
      <h1 className="text-3xl font-black tracking-tight">Profile</h1>

      {comic ? (
        <>
          <div className="mt-6 flex flex-col items-center text-center">
            <span
              aria-hidden
              className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b from-primary/40 to-primary/15 text-[36px] font-semibold text-primary"
            >
              {initialsOf(comic.stage_name || comic.email)}
            </span>
            <p className="mt-3 max-w-full truncate text-[24px] font-semibold">{comic.stage_name || comic.email}</p>
          </div>

          <dl className="mt-6 divide-y divide-border overflow-hidden rounded-xl bg-muted">
            <Row label="Stage name" value={comic.stage_name} />
            <Row label="Instagram" value={comic.instagram} />
            <Row label="Email" value={comic.email} />
          </dl>

          <button
            type="button"
            onClick={onSignOut}
            className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-muted text-[17px] font-semibold text-primary active:bg-primary/15"
          >
            Sign Out
          </button>
        </>
      ) : (
        <div className="mt-6 flex flex-col items-center rounded-xl bg-muted px-6 py-8 text-center">
          <span aria-hidden className="grid h-20 w-20 place-items-center rounded-full bg-background/60 text-muted-foreground">
            <UserRound className="h-10 w-10" />
          </span>
          <p className="mt-4 text-[20px] font-semibold">You&apos;re not signed in</p>
          <p className="mt-1 text-balance text-[17px] font-medium text-muted-foreground">Sign in with your email on the Sign-Up &amp; Lineup tab.</p>
          <Link
            href="/signup"
            className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#dc2626] text-[17px] font-semibold text-white active:bg-[#991b1b]"
          >
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[2.75rem] items-center justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-[17px]">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[17px] text-muted-foreground">{value || "—"}</dd>
    </div>
  );
}
