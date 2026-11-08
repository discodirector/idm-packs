/**
 * The synth voice library (packages/synth/src/voices): sound-design voices any genre renderer can play, each in its
 * own module with no state of its own. A voice builds its graph on the host's context, sends it to one of the host's
 * buses and hands its sources to the host to stop and free. Everything here is deterministic offline (no
 * StereoPannerNode, no DynamicsCompressor, no automated DelayNode, no node with three or more inputs): two renders of
 * the same score are the same samples.
 *
 * First collected for Machine Electro v4 (stations/machine-electro.ts): unison saw stacks, a string machine, a
 * formant choir, FM operators, a layered bass, 808 drum layers and sci-fi bleeps.
 */

/** The engine's buses (styledata.ts BusName). */
export type VoiceBus = "kick" | "snare" | "hat" | "perc" | "bass" | "harm" | "lead" | "tex" | "fx";

export type Source = OscillatorNode | AudioBufferSourceNode;

export interface VoiceHost {
  readonly ctx: BaseAudioContext;
  /**
   * Sends `node` to `bus`: at an equal-power pan -1..1, or straight in (mono to both sides at full level) when `pan`
   * is left out. Returns the nodes to free with the voice.
   */
  out(node: AudioNode, bus: VoiceBus, pan?: number): AudioNode[];
  /** A pairwise sum (bit-exact offline): the new head of the chain; any sum node it makes goes into `rest`. */
  sum(chain: AudioNode | null, node: AudioNode, rest: AudioNode[]): AudioNode;
  /** Stops `src` at `when` and frees `rest` with it. */
  end(src: Source, rest: AudioNode[], when: number): void;
  /** The host's seeded white noise (a looping buffer). */
  noise(): AudioBuffer;
}
