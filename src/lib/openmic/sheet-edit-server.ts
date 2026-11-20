/**
 * The hosts' lineup helper: the add / move / swap half that edits the Google Sheet. The lineup feed and the
 * edit function share one Supabase edge function path, so `lineup-feed` becomes `lineup-edit`. The caller's
 * Supabase access token is the only credential, and it is never logged or put in a reply.
 */

import type { SheetCommand } from "./ai-commands";

const NOT_CONNECTED = "The sheet isn't connected to this app yet.";
const SIGN_IN_AGAIN = "Sign in again as a host to change the lineup.";
export const SHEET_SAVE_FAILED = "That did not save. Check the connection and try again.";

export function editUrlFor(lineupUrl: string): string | null {
  try {
    const url = new URL(lineupUrl);
    const parts = url.pathname.split("/");
    if (parts[parts.length - 1] !== "lineup-feed") return null;
    parts[parts.length - 1] = "lineup-edit";
    url.pathname = parts.join("/");
    return url.toString();
  } catch {
    return null;
  }
}

export type SheetEditResult = { ok: boolean; text: string };

/** The edge function's answer: ok:false is a refusal sentence for the host, not a failed call. */
function sheetAnswer(value: unknown): SheetEditResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const answer = value as Record<string, unknown>;
  if (typeof answer.ok !== "boolean" || typeof answer.text !== "string") return null;
  return { ok: answer.ok, text: answer.text };
}

export async function editSheet(args: {
  lineupUrl: string | null | undefined;
  token: string;
  command: SheetCommand;
  hostRow: boolean;
  fetchImpl?: typeof fetch;
}): Promise<SheetEditResult> {
  const editUrl = args.lineupUrl ? editUrlFor(args.lineupUrl) : null;
  if (!editUrl) return { ok: false, text: NOT_CONNECTED };

  const body: Record<string, unknown> = {
    action: args.command.type,
    name: args.command.name,
    fixed_first_rows: args.hostRow ? 1 : 0,
  };
  if (args.command.type === "add" || args.command.type === "move") {
    body.position = args.command.position;
    if (args.command.of !== undefined) body.of = args.command.of;
  }
  if (args.command.type === "swap") body.other = args.command.other;

  try {
    const response = await (args.fetchImpl ?? fetch)(editUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${args.token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, text: SIGN_IN_AGAIN };
    if (response.status !== 200) return { ok: false, text: SHEET_SAVE_FAILED };
    const answer = sheetAnswer(await response.json());
    return answer ?? { ok: false, text: SHEET_SAVE_FAILED };
  } catch {
    return { ok: false, text: SHEET_SAVE_FAILED };
  }
}
