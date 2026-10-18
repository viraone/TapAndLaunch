"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import type { OpenMicSignupBlockConfig } from "@/types/database";
import { PINNED_PAGE, useOpenMicClient } from "./OpenMicSignupRuntime";
import { ChatThread, joinNames, markThreadRead } from "./OpenMicChatThread";
import { Notice } from "./OpenMicHostsRuntime";
import { syncChatTabs } from "@/lib/openmic/host-chat";

/**
 * StageTime's "Message the Hosts" tab, for signed-in comedians: a private line to the show's hosts (running late,
 * "can I go later?"). One thread per comedian (comedian_messages, keyed by their account); only they and the hosts
 * can read it. The hosts answer from their Hosts tab and are emailed about new messages (notify-hosts).
 */
export function OpenMicMessagesRuntime({ config }: { config: OpenMicSignupBlockConfig }) {
  const client = useOpenMicClient(config);
  const timeZone = config.time_zone ?? "America/Los_Angeles";
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [host, setHost] = useState<boolean | undefined>(undefined);
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const check = async (u: User | null) => {
      setUser(u);
      void syncChatTabs(client, u);
      if (!u) return setHost(undefined);
      const [{ data: isHost }, { data: hostNames }] = await Promise.all([client.rpc("is_host_chat_member"), client.rpc("host_names")]);
      if (cancelled) return;
      setHost(isHost === true);
      setNames((hostNames as string[] | null) ?? []);
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
  if (user === undefined || (user && host === undefined)) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) {
    return (
      <Notice heading="Message the Hosts" title="Sign in to message the hosts">
        <p className="mt-1 text-balance text-[17px] font-medium text-muted-foreground">Sign in with your email on the Sign-Up &amp; Lineup tab.</p>
        <Link
          href="/signup"
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#dc2626] text-[17px] font-semibold text-white active:bg-[#991b1b]"
        >
          Sign in
        </Link>
      </Notice>
    );
  }
  if (host) {
    return (
      <Notice heading="Message the Hosts" title="You're a host. Comedians' messages are in the Hosts tab.">
        <Link
          href="/hosts"
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#dc2626] text-[17px] font-semibold text-white active:bg-[#991b1b]"
        >
          Open the Hosts tab
        </Link>
      </Notice>
    );
  }

  return (
    <div className={PINNED_PAGE}>
      <header className="shrink-0">
        <h1 className="text-3xl font-black tracking-tight">Message the Hosts</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {names.length > 0 ? `Goes to ${joinNames(names)}. ` : ""}Only you and the hosts can see it.
        </p>
      </header>
      <ChatThread
        client={client}
        user={user}
        timeZone={timeZone}
        source={{
          table: "comedian_messages",
          match: { comedian_id: user.id },
          insert: { comedian_id: user.id },
          bucket: "comedian-chat",
          folder: user.id,
          mine: (m) => !m.from_host,
          emptyText: "Running late? Need to move your spot? Message the hosts here and they'll see it.",
          onSeen: (latest) => markThreadRead(client, user.id, user.id, latest),
        }}
      />
    </div>
  );
}
