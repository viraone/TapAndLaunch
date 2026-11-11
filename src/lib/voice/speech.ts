import type { DeepSeekTurn } from "@/lib/ai/deepseek";

/** The one language this first version speaks: Lao as spoken in Laos. */
export const VOICE_LANGUAGE = "lo-LA";

/** Microsoft's two Lao voices. */
export const VOICES = {
  keomany: "lo-LA-KeomanyNeural",
  chanthavong: "lo-LA-ChanthavongNeural",
} as const;

export type VoiceName = keyof typeof VOICES;

/** The largest recording a turn accepts: 60 seconds of 16 kHz 16-bit mono, the speech service's own limit. */
export const MAX_WAV_BYTES = 44 + 60 * 16000 * 2;

export interface SpeechConfig {
  key: string;
  sttUrl: string;
  ttsUrl: string;
}

/** Where the speech service lives and the key for it, or null while AZURE_SPEECH_KEY / AZURE_SPEECH_REGION are not set. */
export function speechConfig(env: Record<string, string | undefined> = process.env): SpeechConfig | null {
  const key = env.AZURE_SPEECH_KEY;
  const region = env.AZURE_SPEECH_REGION;
  if (!key || !region) return null;
  return {
    key,
    sttUrl: env.AZURE_SPEECH_STT_URL || `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`,
    ttsUrl: env.AZURE_SPEECH_TTS_URL || `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
  };
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The request body that asks the voice service to read `text` in one of the Lao voices. */
export function buildSsml(text: string, voice: VoiceName): string {
  return `<speak version='1.0' xml:lang='${VOICE_LANGUAGE}'><voice xml:lang='${VOICE_LANGUAGE}' name='${VOICES[voice]}'>${escapeXml(text)}</voice></speak>`;
}

/** Drops markdown marks a model sometimes adds, which a voice would read aloud, and caps the length. */
export function cleanReply(text: string): string {
  return text.replace(/[*#`_]/g, "").replace(/\s+/g, " ").trim().slice(0, 1500);
}

/** What the model is told before every turn. `persona` is the owner's own description of what the assistant is for. */
export function voiceSystemPrompt(persona?: string): string {
  const base = [
    "You are a friendly voice assistant inside a phone app. The person talks to you in Lao and hears your answer read aloud by a Lao voice.",
    "Always answer in Lao, written in Lao script.",
    "Keep every answer short: one to three sentences. Plain sentences only: no lists, no markdown, no emoji, and no English words unless there is no Lao word.",
    "The person's words come from speech recognition and can be wrong. If they make no sense, ask kindly in Lao to say it again.",
  ].join(" ");
  const extra = persona?.trim();
  return extra ? `${base}\n\nWhat this app is for and what you help with: ${extra.slice(0, 1500)}` : base;
}

/** The earlier turns the browser sent back, cleaned: only user/assistant turns with text, the last ten. */
export function parseHistory(raw: unknown): DeepSeekTurn[] {
  if (typeof raw !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const turns: DeepSeekTurn[] = [];
  for (const item of parsed as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string" || !content.trim()) continue;
    turns.push({ role, content: content.slice(0, 1000) });
  }
  return turns.slice(-10);
}

/** Speech to text: sends a 16 kHz WAV and returns the Lao words heard, or "" when nothing was recognised. */
export async function listen(wav: ArrayBuffer, speech: SpeechConfig): Promise<string> {
  const res = await fetch(`${speech.sttUrl}?language=${VOICE_LANGUAGE}&format=simple`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": speech.key,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      Accept: "application/json",
    },
    body: wav,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`The speech service answered ${res.status}.`);
  const body = (await res.json().catch(() => ({}))) as { RecognitionStatus?: string; DisplayText?: string };
  return body.RecognitionStatus === "Success" ? (body.DisplayText ?? "").trim() : "";
}

/** Text to speech: returns MP3 bytes of `text` read in the chosen Lao voice. */
export async function speak(text: string, voice: VoiceName, speech: SpeechConfig): Promise<ArrayBuffer> {
  const res = await fetch(speech.ttsUrl, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": speech.key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "tapandlaunch-voice",
    },
    body: buildSsml(text, voice),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`The voice service answered ${res.status}.`);
  return res.arrayBuffer();
}
