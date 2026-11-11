import { downsample, encodeWav, joinChunks } from "@/lib/voice/wav";

export interface Recording {
  /** Ends the recording and returns it as a 16 kHz WAV file. */
  stop: () => Promise<ArrayBuffer>;
  /** Ends the recording and throws it away. */
  cancel: () => void;
}

/**
 * Starts recording the microphone. Call it straight from a tap: the AudioContext is made before the first await,
 * which is what lets iOS run it.
 */
export async function startRecording(): Promise<Recording> {
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioContextClass();
  void context.resume();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (error) {
    void context.close().catch(() => undefined);
    throw error;
  }
  const source = context.createMediaStreamSource(stream);
  const node = context.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  node.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(node);
  node.connect(context.destination);
  const release = () => {
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
  };
}
