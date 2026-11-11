/** The quietest level that can count as someone talking (0 = silence, 1 = as loud as the microphone goes). */
export const SPEECH_LEVEL = 0.012;
/** Anything above this is more than a quiet room: enough to send when the person taps the button themself. */
export const HEARD_LEVEL = 0.006;
/** A voice has to be this many times louder than the room's steady noise. */
const NOISE_RATIO = 3;
/** Sound has to stay loud this long before it counts as talking, so a click or a bump doesn't. */
const SPEECH_MIN_MS = 150;
/** This much quiet after talking means the person has finished. */
export const END_SILENCE_MS = 1400;
/** With no talking at all for this long, stop listening. */
export const NO_SPEECH_MS = 8000;

export type VadVerdict = "listening" | "end" | "nospeech";

export interface Vad {
  /** The room's steady noise level, learned from the quiet moments. */
  noise: number;
  /** The loudest level so far. */
  peak: number;
  loudMs: number;
  quietMs: number;
  elapsedMs: number;
  spoke: boolean;
}

export function createVad(): Vad {
  return { noise: 0, peak: 0, loudMs: 0, quietMs: 0, elapsedMs: 0, spoke: false };
}

/** How loud a chunk of samples is: the root mean square, between 0 and 1. */
export function levelOf(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Feeds one chunk's loudness into the detector. It answers "end" once the person has talked and then been quiet for
 * END_SILENCE_MS, "nospeech" when nobody has talked for NO_SPEECH_MS, and "listening" otherwise.
 */
export function feedVad(vad: Vad, level: number, ms: number): VadVerdict {
  vad.elapsedMs += ms;
  if (level > vad.peak) vad.peak = level;
  const threshold = Math.max(SPEECH_LEVEL, vad.noise * NOISE_RATIO);
  if (level >= threshold) {
    vad.loudMs += ms;
    vad.quietMs = 0;
    if (vad.loudMs >= SPEECH_MIN_MS) vad.spoke = true;
  } else {
    vad.loudMs = 0;
    vad.quietMs += ms;
    vad.noise = vad.noise === 0 ? level : vad.noise * 0.9 + level * 0.1;
  }
  if (vad.spoke && vad.quietMs >= END_SILENCE_MS) return "end";
  if (!vad.spoke && vad.elapsedMs >= NO_SPEECH_MS) return "nospeech";
  return "listening";
}
