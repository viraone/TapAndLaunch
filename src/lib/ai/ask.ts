import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askClaudeText, type ClaudeImage } from "@/lib/ai/client";
import { decryptSecret } from "@/lib/ai/keys";
import { chatJson, type AiProvider } from "@/lib/ai/providers";
import type { Database } from "@/types/database";

/**
 * Who answers an AI request for this organization: our own Claude key when the server has one (`ANTHROPIC_API_KEY`),
 * otherwise the organization's own key from "Bring your own bot". The features built on this (Cmd+K, the agent, the
 * paste inbox) work the same either way; only pictures need Claude.
 */
export interface Asker {
  ask: (system: string, user: string, opts?: { maxTokens?: number; timeoutMs?: number; images?: ClaudeImage[] }) => Promise<string>;
  /** Whether this caller can look at a picture. */
  vision: boolean;
  /** For the log: whose key paid. */
  source: "platform" | "org";
}

export async function resolveAsker(admin: SupabaseClient<Database>, organizationId: string): Promise<Asker | null> {
  const platform = process.env.ANTHROPIC_API_KEY;
  if (platform) {
    return {
      source: "platform",
      vision: true,
      ask: (system, user, opts) => askClaudeText({ system, user, apiKey: platform, maxTokens: opts?.maxTokens ?? 4000, timeoutMs: opts?.timeoutMs, images: opts?.images }),
    };
  }
  const { data: keyRow } = await admin.from("org_ai_keys").select("provider, encrypted_key, model").eq("organization_id", organizationId).maybeSingle();
  if (!keyRow) return null;
  const provider = keyRow.provider as AiProvider;
  const key = decryptSecret(keyRow.encrypted_key);
  if (provider === "anthropic") {
    return {
      source: "org",
      vision: true,
      ask: (system, user, opts) => askClaudeText({ system, user, apiKey: key, maxTokens: opts?.maxTokens ?? 4000, timeoutMs: opts?.timeoutMs, images: opts?.images }),
    };
  }
  return {
    source: "org",
    vision: false,
    ask: (system, user) => chatJson(provider, key, keyRow.model, system, [{ role: "user", content: user }]),
  };
}

export const NO_AI_MESSAGE = "AI isn't switched on for this account yet. Add your own AI key under Settings, or ask us to switch it on.";
