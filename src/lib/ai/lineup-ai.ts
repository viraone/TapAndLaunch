import { askDeepSeek, type DeepSeekTurn } from "./deepseek";
import { askGemini } from "./gemini";

/**
 * The lineup helper's answer: Gemini first when its key is set, DeepSeek as the backup when Gemini fails (refused,
 * too slow, blank) or has no key. Throws when neither key is set, or when the last one tried fails.
 */
export async function askLineupAi(input: {
  system: string;
  turns: DeepSeekTurn[];
  geminiKey?: string;
  deepseekKey?: string;
}): Promise<string> {
  const { system, turns, geminiKey, deepseekKey } = input;
  if (geminiKey) {
    try {
      return await askGemini({ system, turns, apiKey: geminiKey });
    } catch (error) {
      if (!deepseekKey) throw error;
      console.error(`lineup-ai: Gemini failed, using DeepSeek: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!deepseekKey) throw new Error("No AI key is set.");
  return askDeepSeek({ system, turns, apiKey: deepseekKey });
}
