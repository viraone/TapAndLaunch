import type { LineupEntry } from "@/lib/openmic/selection";
import { onDeckFor, type ShowClock } from "@/lib/openmic/show-clock";

/** One plain sentence about the live show for the hosts' AI helper: who is on stage and who is on deck. */
export function showStatusLine(clock: ShowClock, lineup: LineupEntry[], hostRow: boolean): string {
  if (lineup.length === 0) return "The lineup is empty.";
  if (clock.kind === "running") {
    const on = lineup[clock.index];
    const deckIndex = onDeckFor(clock, lineup.length, hostRow);
    const deck = deckIndex >= 0 ? lineup[deckIndex] : undefined;
    const m = Math.ceil(Math.abs(clock.remainingMs) / 60000);
    const onText = !on
      ? "Nobody is on stage right now."
      : clock.remainingMs >= 0
        ? `${on.name} is on stage now, about ${m} min left.`
        : `${on.name} is on stage now and is ${m} min over time.`;
    return deck ? `${onText} ${deck.name} is on deck.` : `${onText} Nobody is after them.`;
  }
  if (clock.nextIndex < 0) return "The show is over: every comic has gone up.";
  const deckIndex = onDeckFor(clock, lineup.length, hostRow);
  const deck = deckIndex >= 0 ? lineup[deckIndex] : undefined;
  return deck ? `Nobody is on stage right now. ${deck.name} is on deck.` : "Nobody is on stage right now.";
}
