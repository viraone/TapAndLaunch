"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { HOSTS_NAV_FLAG } from "@/lib/openmic/host-chat";
import { readNavFlag, subscribeNavFlags } from "@/lib/pwa/nav-flags";

/** Shows `forEveryone` until this browser is known to be a host's, then `forHosts`. The server draws `forEveryone` (it only
 *  sees the hosts cookie on later visits); the moment a host signs in, the switch fires and this swaps without a reload. */
export function HostSwitch({ forEveryone, forHosts }: { forEveryone: ReactNode; forHosts: ReactNode }) {
  const isHost = useSyncExternalStore(
    subscribeNavFlags,
    () => readNavFlag(HOSTS_NAV_FLAG),
    () => false
  );
  return <>{isHost ? forHosts : forEveryone}</>;
}
