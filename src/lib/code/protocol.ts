/** Marks the end of the streamed answer from the code-chat route; what follows is a JSON result. */
export const RESULT_MARK = "\n\u0001RESULT\u0001";

export interface CodeChatResult {
  reply?: string;
  version?: number;
  files?: Record<string, string> | null;
  changed?: string[];
  note?: string;
  error?: string;
}

/** Splits the streamed text into the model's answer so far and, once it has finished, the result. */
export function splitStream(text: string): { answer: string; result: CodeChatResult | null } {
  const at = text.indexOf(RESULT_MARK);
  if (at === -1) return { answer: text, result: null };
  try {
    return { answer: text.slice(0, at), result: JSON.parse(text.slice(at + RESULT_MARK.length)) as CodeChatResult };
  } catch {
    return { answer: text.slice(0, at), result: null };
  }
}

/**
 * Sections of a new app are written at the same time, so their text arrives interleaved. Each piece is wrapped as
 * <tl-chunk path="src/components/Hero.jsx">text</tl-chunk> (a reset attribute means "start over"). Each finished file
 * is also sent whole as a normal <file> block, so the pieces are only for showing work in progress.
 */
export const chunk = (path: string, text: string, reset = false) => `<tl-chunk path="${path}"${reset ? " reset" : ""}>${text}</tl-chunk>`;

/** Separates the pieces from the rest of the answer: the answer without them, and each file's text so far. */
export function demux(text: string): { main: string; streams: Record<string, string> } {
  const streams: Record<string, string> = {};
  let main = text.replace(/<tl-chunk path="([^"]+)"( reset)?>([\s\S]*?)<\/tl-chunk>/g, (_m, path: string, reset: string | undefined, body: string) => {
    streams[path] = (reset ? "" : (streams[path] ?? "")) + body;
    return "";
  });
  // A piece that has only partly arrived yet.
  const open = main.lastIndexOf("<tl-chunk");
  if (open !== -1) main = main.slice(0, open);
  return { main, streams };
}
