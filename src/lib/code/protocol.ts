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
