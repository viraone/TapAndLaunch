import { askDeepSeek, type DeepSeekTurn } from "./deepseek";
import { askGemini } from "./gemini";

/**
 * The lineup helper's answer: DeepSeek first when its key is set, Gemini's free tier as the backup when DeepSeek fails
 * or has no key. Gemini is second because on 2026-11-23 it did not answer within 15 s from production, while DeepSeek
 * takes 1 to 2 s. Throws when neither key is set, or when the last one tried fails.
 */
export async function askLineupAi(input: {
  system: string;
  turns: DeepSeekTurn[];
  geminiKey?: string;
  deepseekKey?: string;
}): Promise<string> {
  const { system, turns, geminiKey, deepseekKey } = input;
  if (deepseekKey) {
    try {
      return await askDeepSeek({ system, turns, apiKey: deepseekKey });
    } catch (error) {
      if (!geminiKey) throw error;
      console.error(`lineup-ai: DeepSeek failed, using Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!geminiKey) throw new Error("No AI key is set.");
  return askGemini({ system, turns, apiKey: geminiKey });
}
