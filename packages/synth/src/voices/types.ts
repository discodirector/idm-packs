/**
 * The shared synth voice library (docs/sound/VOICE-LIBRARY.md): self-contained instruments that any WebAudio graph
 * (the engine, the Style Lab, an offline audition, IDM Sounds) plays note by note. Each voice renders one note from
 * plain data through a small host the caller provides, so the same voice can sit on a hip-hop keys part, a film score
 * or a hamster electro track, and a pack names a voice instead of re-inventing it.
 *
 * Rules every voice keeps (the engine's offline renders are bit-exact and checked twice):
 * - no DynamicsCompressor, StereoPanner, oversampled WaveShaper or automated DelayNode (not bit-exact in Chromium);
 * - no node and no AudioParam gets more than two audio inputs (sum two at a time: util.ts sumAll / pairSum);
 * - every envelope lands on exactly 0 before its sources stop;
 * - randomness only from the note's `seed` (hash.ts hash32 / mulberry32), never Math.random.
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
  /**
   * Optional: sends a mono node straight into the bus, unity on both channels (no pan law: the engine's bass, kick and
   * snare-body voices that were never panned). Voices fall back to `out(node, 0)` (3 dB lower) without it: util.ts center.
   */
  center?(node: AudioNode): AudioNode[];
  /** Starts the sources at `time`, stops them at `end`, and frees every node then. */
  play(sources: Source[], nodes: AudioNode[], time: number, end: number): void;
  /**
   * Optional: stops a source the voice has already started itself at `when` and frees `nodes` with it (the imported
   * packs' `end`: Machine Electro, Pop House). Without it the adapters just call `src.stop(when)`.
   */
  stop?(src: Source, nodes: AudioNode[], when: number): void;
  /**
   * Optional: the host's narrow pulse wave at `duty` (the engine's own cached `pulseWave`, so a re-pointed engine voice
   * reuses the engine's wave). Voices fall back to util.ts pulseWave (cached per context).
   */
  pulse?(duty: number): PeriodicWave;
  /** Optional: a live AudioContext (the radio) rather than an offline render (Pop House's ensemble keeps a DC floor offline). */
  readonly live?: boolean;
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
  /**
   * Chord voices only (pads/electroPad): the chord as semitones over `freq`, played at once through one filter. Other
   * voices ignore it (play a chord as one note per tone).
   */
  chord?: readonly number[];
}

/** A voice's numeric parameters: every field a number (a switch is 0 / 1). */
export type VoiceParams = Record<string, number>;

/**
 * A numeric voice module (the Hip-Hop & Trap v3 shape): its note renderer, defaults, valid ranges (pack validation reads
 * them) and a one-line doc. `VOICES` in index.ts keeps exactly these, so a pack's `SynthLayer` can name them.
 */
export interface VoiceModule<P extends VoiceParams = VoiceParams> {
  doc: string;
  defaults: P;
  ranges: { [K in keyof P]: readonly [number, number] };
  play(h: VoiceHost, n: VoiceNote, p: P): void;
}

/** The library's shelves. */
export type VoiceCategory =
  | "pads"
  | "strings"
  | "brass"
  | "keys"
  | "plucks"
  | "bells"
  | "choirs"
  | "leads"
  | "bass"
  | "drums"
  | "fx";

/** Where a voice (and its presets) came from: the approved, frozen pack it reproduces. */
export type VoiceSource =
  | "hiphop-trap-v3"
  | "cinematic-v2"
  | "hamster-electro-2-v2"
  | "machine-electro-v4.2"
  | "liquid-dnb-v7"
  | "pop-house-v3"
  | "synth-v2";

/**
 * One catalog entry: a voice with its shelf, its source pack, its timbre / role doc, the rules for using it, defaults,
 * and named presets (each the exact settings an approved pack played it with, plus the library's recommended ones).
 * `P` may be structured (an oscillator list, formants, drum layers): numeric `ranges` are given where the params are
 * flat numbers.
 */
export interface LibraryVoice<P extends object = any> {
  /** Catalog key (unique across the library). */
  id: string;
  category: VoiceCategory;
  /** The approved packs it comes from (its code and its presets). */
  source: readonly VoiceSource[];
  /** Timbre and role in a sentence or two. */
  doc: string;
  /** Usage rules (what the owner approved / rejected about this sound). */
  rules: readonly string[];
  /** Comfortable MIDI range [low, high] (the audition plays it here). */
  register: readonly [number, number];
  defaults: P;
  ranges?: Partial<Record<keyof P, readonly [number, number]>>;
  /** Named presets merged over `defaults` (a structured preset replaces whole fields). */
  presets: Readonly<Record<string, Partial<P>>>;
  /** The preset the library recommends when a pack names the voice without settings (omitted: `defaults`). */
  preferred?: string;
  /**
   * Plays `n.chord` (semitones over `n.freq`) as one event (a chord voice: one filter, one buffer or one worklet node
   * for the whole chord). Other voices are played one note per tone.
   */
  chordal?: boolean;
  /**
   * The owner's ear: "avoid" = in the library for completeness and fidelity, but organ-like, reedy, ringing or otherwise
   * against the house rules (docs/sound/VOICE-LIBRARY.md); never named by a new pack without asking. Omitted = fine.
   */
  caution?: string;
  play(h: VoiceHost, n: VoiceNote, p: P): void;
}

/**
 * A pack naming a library voice (the engine's opt-in `library` slots, styledata.ts ElectroData.library): the voice's
 * catalog id, a preset (omitted: the voice's preferred one), param overrides, a velocity scale and a register shift.
 */
export interface LibraryVoiceRef {
  voice: string;
  preset?: string;
  params?: Readonly<Record<string, unknown>>;
  /** Scales the note velocity, 0..2 (default 1). */
  level?: number;
  /** Register shift, semitones -24..24 (default 0). */
  octave?: number;
}
