"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import type { VoiceChatBlockConfig } from "@/types/database";
import { EditableText } from "@/components/pwa-runtime/Editable";
import { startRecording, type Recording } from "@/lib/voice/record";
import { encodeWav } from "@/lib/voice/wav";

export type VoicePhase = "idle" | "recording" | "thinking" | "speaking";

export interface VoiceTurn {
  role: "user" | "assistant";
  content: string;
}

/** A recording stops by itself after this long, so a forgotten microphone doesn't run on. */
const MAX_SECONDS = 30;

const PHASE_LABEL: Record<VoicePhase, string> = {
  idle: "Tap to talk · ກົດເພື່ອເວົ້າ",
  recording: "Listening… tap to send · ກຳລັງຟັງ",
  thinking: "Thinking… · ກຳລັງຄິດ",
  speaking: "Speaking… tap to stop · ກຳລັງເວົ້າ",
};

const MIC_BLOCKED = "Allow the microphone to talk. · ກະລຸນາອະນຸຍາດໃຫ້ໃຊ້ໄມໂຄຣໂຟນ.";
const NOT_HEARD = "I didn't catch that. Try again. · ບໍ່ໄດ້ຍິນ, ລອງໃໝ່ອີກຄັ້ງ.";
const TRY_AGAIN = "Something went wrong. Try again. · ມີບັນຫາ, ລອງໃໝ່ອີກຄັ້ງ.";

const USER_BUBBLE = "ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-base leading-relaxed text-primary-foreground";
const REPLY_BUBBLE = "mr-auto w-fit max-w-[85%] rounded-2xl bg-muted px-4 py-2 text-base leading-relaxed";

/** The Voice chat block: one round button. Tap, speak Lao, tap again; the reply appears as text and is read aloud in Lao. */
export function VoiceChatBlockView({
  config,
  live,
  initial,
}: {
  config: VoiceChatBlockConfig;
  live: boolean;
  /** A fixed state to draw, for the dev preview page only. */
  initial?: { phase: VoicePhase; turns: VoiceTurn[] };
}) {
  const [phase, setPhase] = useState<VoicePhase>(initial?.phase ?? "idle");
  const [turns, setTurns] = useState<VoiceTurn[]>(initial?.turns ?? []);
  const [error, setError] = useState<string | null>(null);
  const history = useRef<VoiceTurn[]>(initial?.turns ?? []);
  const recording = useRef<Recording | null>(null);
  const starting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      recording.current?.cancel();
      player.current?.pause();
    };
  }, []);

  /** iOS only plays sound that a tap started, so the first tap plays a moment of silence on the player the replies will use. */
  function unlockPlayer() {
    if (player.current) return;
    const audio = new Audio(URL.createObjectURL(new Blob([encodeWav(new Float32Array(1600))], { type: "audio/wav" })));
    void audio.play().catch(() => undefined);
    player.current = audio;
  }

  async function finish() {
    const current = recording.current;
    if (!current) return;
    recording.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPhase("thinking");
    try {
      const wav = await current.stop();
      const form = new FormData();
      form.append("audio", new Blob([wav], { type: "audio/wav" }), "turn.wav");
      form.append("history", JSON.stringify(history.current.slice(-10)));
      const res = await fetch("/voice-chat/turn", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { heard?: string; reply?: string; audio?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? TRY_AGAIN);
        setPhase("idle");
        return;
      }
      if (!data.heard || !data.reply) {
        setError(NOT_HEARD);
        setPhase("idle");
        return;
      }
      history.current = [...history.current, { role: "user", content: data.heard }, { role: "assistant", content: data.reply }];
      setTurns(history.current);
      const audio = player.current;
      if (!audio || !data.audio) {
        setPhase("idle");
        return;
      }
      audio.src = `data:audio/mpeg;base64,${data.audio}`;
      audio.onended = () => setPhase("idle");
      audio.onerror = () => setPhase("idle");
      setPhase("speaking");
      void audio.play().catch(() => setPhase("idle"));
    } catch {
      setError(TRY_AGAIN);
      setPhase("idle");
    }
  }

  function onTap() {
    if (!live) return;
    setError(null);
    if (phase === "recording") {
      void finish();
      return;
    }
    if (phase === "speaking") {
      player.current?.pause();
      setPhase("idle");
      return;
    }
    if (phase !== "idle" || starting.current) return;
    starting.current = true;
    unlockPlayer();
    void startRecording().then(
      (started) => {
        starting.current = false;
        recording.current = started;
        setPhase("recording");
        timer.current = setTimeout(() => void finish(), MAX_SECONDS * 1000);
      },
      () => {
        starting.current = false;
        setError(MIC_BLOCKED);
      },
    );
  }

  return (
    <section className="px-4 py-5 @lg:mx-auto @lg:max-w-3xl @lg:px-8 @lg:py-10">
      <EditableText as="h2" path={["title"]} value={config.title} placeholder="Talk in Lao" className="px-1 text-2xl font-extrabold tracking-tight @lg:text-4xl" />
      <EditableText as="p" path={["intro"]} value={config.intro} placeholder="A line under the title" className="mt-1 px-1 text-sm text-muted-foreground" />
      <div className="mt-4 space-y-2" aria-live="polite">
        {config.greeting ? (
          <p lang="lo" className={REPLY_BUBBLE}>
            {config.greeting}
          </p>
        ) : null}
        {turns.slice(-6).map((turn, i) => (
          <p key={i} lang="lo" className={turn.role === "user" ? USER_BUBBLE : REPLY_BUBBLE}>
            {turn.content}
          </p>
        ))}
      </div>
      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={onTap}
          disabled={phase === "thinking"}
          aria-label={PHASE_LABEL[phase]}
          className={`flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition active:scale-95 disabled:opacity-60 ${phase === "recording" ? "animate-pulse bg-red-600 text-white" : "bg-primary text-primary-foreground"}`}
        >
          {phase === "recording" ? (
            <Square className="h-8 w-8" />
          ) : phase === "thinking" ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : phase === "speaking" ? (
            <Volume2 className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </button>
        <p className="text-center text-sm font-medium text-muted-foreground">{PHASE_LABEL[phase]}</p>
        {error ? (
          <p role="alert" className="text-center text-sm font-medium text-red-500">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
