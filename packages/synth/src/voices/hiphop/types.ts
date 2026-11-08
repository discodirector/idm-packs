/**
 * The synth voice library: self-contained instruments the engine (or any other WebAudio graph) plays note by note.
 * Each module renders one note of one instrument from plain numbers, through a small host the caller provides, so the
 * same voice can sit on a hip-hop keys part today and in a shared library tomorrow.
 *
 * Rules every voice keeps (the engine's offline renders are bit-exact and checked twice):
 * - no DynamicsCompressor, StereoPanner, oversampled WaveShaper or automated DelayNode (not bit-exact in Chromium);
 * - no node and no AudioParam gets more than two audio inputs (sum two at a time: util.ts sumAll);
 * - every envelope lands on exactly 0 before its sources stop;
 * - randomness only from the note's `seed` (hash.ts mulberry32), never Math.random.
 */
export type Source = OscillatorNode | AudioBufferSourceNode;

export interface VoiceHost {
  readonly ctx: BaseAudioContext;
  /** A two-second white noise buffer (loop it). */
  noise(): AudioBuffer;
  /** A buffer made once per key and cached (Karplus-Strong strings, impulse shapes). */
  buffer(key: string, make: () => AudioBuffer): AudioBuffer;
  /** A sawtooth or a pulse (duty 0.05..0.5) or a sine, starting at phase k / 16 of a turn (unison stacks never start in phase). */
  wave(kind: "saw" | "pulse" | "sine", k: number, duty?: number): PeriodicWave;
  /** Sends a mono node out at a pan -1..1 into the voice's bus; returns the nodes to free with the note. */
  out(node: AudioNode, pan: number): AudioNode[];
  /** Starts the sources at `time`, stops them at `end`, and frees every node then. */
  play(sources: Source[], nodes: AudioNode[], time: number, end: number): void;
}

export interface VoiceNote {
  /** Onset, s (context time). */
  time: number;
  /** Pitch, Hz. */
  freq: number;
  /** Held length, s (the release follows). */
  length: number;
  /** 0..1 */
  vel: number;
  /** Glide: slide from this pitch (Hz) when the voice glides. */
  from?: number;
  /** -1..1, the voice's place; stereo voices spread around it. */
  pan: number;
  /** 0..1, how open the song form is right now (the section's filter): voices open their filters with it. */
  bright: number;
  /** A per-note integer: phases, noise and small drifts come from it. */
  seed: number;
}

/** A voice's numeric parameters: every field a number (a switch is 0 / 1). */
export type VoiceParams = Record<string, number>;

/** A voice module: its note renderer, defaults, valid ranges (pack validation reads them) and a one-line doc. */
export interface VoiceModule<P extends VoiceParams = VoiceParams> {
  doc: string;
  defaults: P;
  ranges: { [K in keyof P]: readonly [number, number] };
  play(h: VoiceHost, n: VoiceNote, p: P): void;
}
