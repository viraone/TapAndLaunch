// One place that talks to the Mac Studio's model (DeepSeek V4-Flash served by oMLX, OpenAI-compatible API).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const STUDIO_URL = process.env.STUDIO_URL ?? "http://Mac-Studio.local:8000/v1";
export const STUDIO_MODEL = process.env.STUDIO_MODEL ?? "DeepSeek-V4-Flash-0731-MXFP4-MLX";

function studioKey() {
  if (process.env.STUDIO_API_KEY) return process.env.STUDIO_API_KEY.trim();
  const file = path.join(os.homedir(), ".config", "omlx-studio", "api_key");
  try { return fs.readFileSync(file, "utf8").trim(); } catch { throw new Error(`No Studio key: set STUDIO_API_KEY or put the key in ${file}`); }
}

// True when the Studio's model server answers.
export async function studioUp() {
  try {
    const res = await fetch(`${STUDIO_URL}/models`, { headers: { Authorization: `Bearer ${studioKey()}` }, signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}

// One request; the answer is streamed because a request can wait in line behind others. Returns the reply text, throws on an HTTP error.
export async function studioChat({ prompt, schema, maxTokens = 6000, timeoutMs = 10 * 60 * 1000, model = STUDIO_MODEL }) {
  const body = { model, stream: true, temperature: 0, max_tokens: maxTokens, chat_template_kwargs: { enable_thinking: false }, messages: [{ role: "user", content: prompt }] };
  if (schema) body.response_format = { type: "json_schema", json_schema: { name: "result", schema } };
  const res = await fetch(`${STUDIO_URL}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${studioKey()}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok || !res.body) throw new Error(`Studio error ${res.status}`);
  let content = "";
  let buf = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try { content += JSON.parse(data).choices?.[0]?.delta?.content ?? ""; } catch {}
    }
  }
  return content;
}
