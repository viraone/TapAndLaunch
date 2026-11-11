import { HEARD_LEVEL, createVad, feedVad, levelOf, type VadVerdict } from "@/lib/voice/vad";
import { downsample, encodeWav, joinChunks } from "@/lib/voice/wav";

export interface Recording {
  /** Ends the recording and returns it as a 16 kHz WAV file. */
  stop: () => Promise<ArrayBuffer>;
  /** Ends the recording and throws it away. */
  cancel: () => void;
  /** True once the microphone has picked up something louder than a quiet room. */
  heard: () => boolean;
}

/** What the recorder reports by itself, once: the person finished talking, or nobody talked. */
export type RecordingVerdict = Exclude<VadVerdict, "listening">;

/**
 * Starts recording the microphone and listens for the end of speech. Call it straight from a tap the first time: the
 * AudioContext is made before the first await, which is what lets iOS run it. `onVerdict` is called at most once:
 * "end" when the person has talked and then gone quiet, "nospeech" when nobody talked or no sound arrived at all.
 */
export async function startRecording(onVerdict?: (verdict: RecordingVerdict) => void): Promise<Recording> {
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioContextClass();
  void context.resume().catch(() => undefined);
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (error) {
    void context.close().catch(() => undefined);
    throw error;
  }
  // Without a tap (the later turns of a hands-free chat) the browser only lets the audio engine start once the
  // microphone is live, so ask again here. Not awaited: where it is refused, the promise may never settle.
  void context.resume().catch(() => undefined);
  const source = context.createMediaStreamSource(stream);
  const node = context.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const vad = createVad();
  let done = false;
  const report = (verdict: RecordingVerdict) => {
    if (done) return;
    done = true;
    onVerdict?.(verdict);
  };
  node.onaudioprocess = (event) => {
    const samples = new Float32Array(event.inputBuffer.getChannelData(0));
    chunks.push(samples);
    const verdict = feedVad(vad, levelOf(samples), (samples.length / context.sampleRate) * 1000);
    if (verdict !== "listening") report(verdict);
  };
  source.connect(node);
  node.connect(context.destination);
  // If no sound arrives at all (the audio engine stayed asleep), don't sit there with the microphone open.
  const watchdog = setTimeout(() => {
    if (chunks.length === 0) report("nospeech");
  }, 2500);
  const release = () => {
    done = true;
    clearTimeout(watchdog);
    node.onaudioprocess = null;
    node.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
  };
  return {
    stop: async () => {
      release();
      const rate = context.sampleRate;
      await context.close().catch(() => undefined);
      return encodeWav(downsample(joinChunks(chunks), rate));
    },
    cancel: () => {
      release();
      void context.close().catch(() => undefined);
    },
    heard: () => vad.peak >= HEARD_LEVEL,
  };
}
