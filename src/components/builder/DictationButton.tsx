"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Mic } from "lucide-react";

/** The few parts of the browser's speech recognition we use (it isn't in TypeScript's built-in types yet). */
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noSubscribe = () => () => {};

const MESSAGES: Record<string, string> = {
  "not-allowed": "Allow the microphone for this site in your browser settings, then try again.",
  "service-not-allowed": "Allow the microphone for this site in your browser settings, then try again.",
  "audio-capture": "No microphone was found.",
  network: "Voice typing needs an internet connection.",
};

/**
 * A round mic button that types what the owner says into a text box (the browser's built-in speech recognition, so
 * nothing is recorded or sent anywhere by us). It is hidden in browsers that can't do it. Speech is added after
 * whatever is already typed; tap again to stop, then edit or send as usual.
 */
export function DictationButton({
  value,
  onChange,
  disabled,
  maxLength,
  large,
  onDone,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  maxLength: number;
  /** 48px instead of 44px, to sit next to a bigger send button. */
  large?: boolean;
  /** Called with the final text when speaking ends (the owner tapped stop, or went quiet) and something was said. */
  onDone?: (text: string) => void;
}) {
  const supported = useSyncExternalStore(noSubscribe, () => recognitionCtor() !== undefined, () => false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const base = useRef("");
  const heard = useRef(false);
  const latest = useRef({ onChange, maxLength, onDone, value });
  useEffect(() => {
    latest.current = { onChange, maxLength, onDone, value };
  });

  // Stop when the box is turned off (a message is being sent) or the panel closes.
  useEffect(() => {
    if (disabled) {
      heard.current = false;
      recognition.current?.stop();
    }
  }, [disabled]);
  useEffect(
    () => () => {
      heard.current = false;
      recognition.current?.stop();
    },
    []
  );

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    heard.current = false;
    base.current = value && !/\s$/.test(value) ? `${value} ` : value;
    r.onresult = (e) => {
      heard.current = true;
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i]?.[0]?.transcript ?? "";
      latest.current.onChange((base.current + said.trimStart()).slice(0, latest.current.maxLength));
    };
    r.onerror = (e) => {
      const message = MESSAGES[e.error];
      if (message) toast.error(message);
    };
    r.onend = () => {
      setListening(false);
      recognition.current = null;
      // Hands-free: when speaking ends, send what was said straight away (the version list makes any change easy to undo).
      if (heard.current) {
        heard.current = false;
        // A moment later, so the last words have reached the box.
        setTimeout(() => {
          const text = latest.current.value.trim();
          if (text) latest.current.onDone?.(text);
        }, 200);
      }
    };
    try {
      r.start();
      recognition.current = r;
      setListening(true);
    } catch {
      toast.error("Couldn't start voice typing. Try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop voice typing" : "Talk instead of typing"}
      title={onDone ? (listening ? "Tap to stop and send" : "Talk, then tap again to send") : undefined}
      className={`relative grid ${large ? "h-12 w-12" : "h-11 w-11"} shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${
        listening ? "bg-red-500 text-white" : "bg-white/[0.06] text-neutral-300 ring-1 ring-white/10 hover:bg-white/10"
      }`}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/50 motion-reduce:animate-none" aria-hidden />}
      <Mic className="relative h-5 w-5" />
    </button>
  );
}
