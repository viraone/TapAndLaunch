// The live spotlight actions that need the network, shared by the AI tab and the hosts' tappable lineup. The plan
// itself is pure (ai-commands.ts); this only saves it and buzzes the comic now on deck.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineupEntry } from "@/lib/openmic/selection";
import { setSpotlight } from "@/lib/openmic/spotlight";
import { planSpotlight, spotlightReply } from "@/lib/openmic/ai-commands";
import { upNextStatus } from "@/lib/openmic/push";

/** The up-next push, the same call the Remote makes: the server checks the token is a host's. */
export async function pushUpNext(name: string, sessionToken: string | undefined): Promise<{ sent: number; matched: number } | null> {
  try {
    const res = await fetch("/openmic/up-next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: sessionToken, name }),
    });
    return res.ok ? ((await res.json()) as { sent: number; matched: number }) : null;
  } catch {
    return null;
  }
}

/** Put one comic on deck: move the spotlight, then buzz the comic now on deck. Returns the line the host reads. */
export async function putOnDeck(args: {
  client: SupabaseClient;
  lineup: LineupEntry[];
  showDate: string;
  name: string;
  sessionToken: string | undefined;
}): Promise<string> {
  const { client, lineup, showDate, name, sessionToken } = args;
  const plan = planSpotlight({ type: "on_deck", name }, lineup);
  if (!plan.ok) return plan.text;
  try {
    const problem = await setSpotlight(client, showDate, lineup, plan.index);
    if (problem) return "That did not save. Check the connection and try again.";
    const result = await pushUpNext(plan.name, sessionToken);
    return `${spotlightReply(plan)} ${upNextStatus(plan.name, result)}`;
  } catch {
    return "That did not save. Check the connection and try again.";
  }
}
