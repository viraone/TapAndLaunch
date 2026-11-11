import { getPublishedApp } from "@/lib/pwa/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { allowSearch, clientAddress } from "@/lib/domains/search-limit";
import { askDeepSeek } from "@/lib/ai/deepseek";
import { MAX_WAV_BYTES, cleanReply, listen, parseHistory, speak, speechConfig, voiceSystemPrompt } from "@/lib/voice/speech";
import type { VoiceChatBlockConfig } from "@/types/database";

/** One turn waits on three services in a row: speech to text, the model, text to speech. */
export const maxDuration = 60;

/** The app's first Voice chat block, or null when the app has none (which also keeps this route closed for it). */
async function voiceConfigFor(appId: string): Promise<VoiceChatBlockConfig | null> {
  const admin = createAdminClient();
  const { data: pages } = await admin.from("pages").select("id").eq("app_id", appId);
  const pageIds = (pages ?? []).map((p) => p.id);
  if (pageIds.length === 0) return null;
  const { data: blocks } = await admin.from("blocks").select("config").in("page_id", pageIds).eq("type", "voice_chat").limit(1);
  const found = blocks?.[0];
  return found ? (found.config as VoiceChatBlockConfig) : null;
}

/** One spoken turn: a WAV recording in; the words heard, the reply in Lao, and the reply read aloud (MP3 as base64) out. */
export async function POST(request: Request, context: { params: Promise<{ appSlug: string }> }) {
  const { appSlug } = await context.params;
  const published = await getPublishedApp(appSlug);
  if (!published) return Response.json({ error: "Not found" }, { status: 404 });
  const config = await voiceConfigFor(published.app.id);
  if (!config) return Response.json({ error: "This app has no voice chat" }, { status: 404 });

  if (!allowSearch(`voice:${clientAddress(request)}`, Date.now(), 12)) {
    return Response.json({ error: "Too many turns. Wait a minute and try again." }, { status: 429 });
  }
  const speech = speechConfig();
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!speech || !apiKey) return Response.json({ error: "Voice chat isn't connected yet." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size < 1000 || audio.size > MAX_WAV_BYTES) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }
  const history = parseHistory(form?.get("history"));

  try {
    const heard = await listen(await audio.arrayBuffer(), speech);
    if (!heard) return Response.json({ heard: "", reply: "", audio: "" });
    const answer = await askDeepSeek({ system: voiceSystemPrompt(config.persona), turns: [...history, { role: "user", content: heard }], apiKey });
    const reply = cleanReply(answer);
    const spoken = await speak(reply, config.voice === "chanthavong" ? "chanthavong" : "keomany", speech);
    return Response.json({ heard, reply, audio: Buffer.from(spoken).toString("base64") });
  } catch (error) {
    console.error("voice turn failed", error);
    return Response.json({ error: "The voice service didn't answer. Try again." }, { status: 502 });
  }
}
