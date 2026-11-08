/**
 * The shared synth voice library's contract (packages/synth/src/voices). A voice module is a pure function of a
 * `VoiceHost` (what the engine lends it: the audio context, its bit-exact helpers, its buses) and plain numbers; it
 * builds and schedules its own nodes and never touches engine state. Every module here is opt-in: nothing in the
 * house styles calls it, so the house graph is unchanged by the library.
 *
 * Offline renders must stay bit-exact run to run (the gate renders every clip twice), so a voice follows the
 * engine's rules: sum two inputs at a time (`sum`), pan with `pan` (no StereoPannerNode), no DynamicsCompressor, no
 * oversampled WaveShaper, no automated DelayNode.delayTime, every envelope ending on exactly 0, every source handed
 * to `end` with the nodes it owns.
 */

/** A bus input: sums whatever is added into it (engine.ts MixChain). */
export interface BusIn {
  add(node: AudioNode): void;
}

export interface VoiceHost {
  readonly ctx: BaseAudioContext;
  /** Live playback (an AudioContext) rather than an offline render. */
  readonly live: boolean;
  /** `chain` + `node` through one new gain (bit-exact offline); returns the new head. `rest` collects it. */
  sum(chain: AudioNode | null, node: AudioNode, rest: AudioNode[]): AudioNode;
  /** An equal-power pan (-1..1) into `bus`; add the voice's output to the returned input. */
  pan(amount: number, bus: BusIn): BusIn & { dest: AudioNode };
  /** Stop `src` at `when` and release it with the nodes in `rest`. */
  end(src: AudioScheduledSourceNode, rest: AudioNode[], when: number): void;
  /** A tanh stage after `node` at `drive` (none under 0.05); returns the node to continue from. */
  drive(node: AudioNode, drive: number, rest: AudioNode[]): AudioNode;
  /** The engine's seeded 2 s white-noise buffer. */
  noise(): AudioBuffer;
}

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Amp envelope on `param`: linear attack to `peak`, exponential decay to `sustain` x peak, held until `hold`, then an
 * exponential release that lands on exactly 0. Returns the end time.
 */
export function adsr(param: AudioParam, t: number, peak: number, attack: number, decay: number, sustain: number, hold: number, release: number): number {
  const a = Math.max(0.001, Math.min(attack, hold));
  const p = Math.max(0.0002, peak);
  const s = Math.max(0.0001, p * sustain);
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(p, t + a);
  if (hold >= a + decay) {
    param.exponentialRampToValueAtTime(s, t + a + decay);
    param.setValueAtTime(s, t + hold);
  } else {
    const frac = clamp((hold - a) / Math.max(0.001, decay), 0, 1);
    param.exponentialRampToValueAtTime(Math.max(0.0001, p * (s / p) ** frac), t + Math.max(hold, a + 0.002));
  }
  const end = t + Math.max(hold, a + 0.002) + release;
  param.exponentialRampToValueAtTime(0.0001, end);
  param.setValueAtTime(0, end);
  return end;
}

/** A biquad of `type` at `freq` / `q` (fixed). */
export function biquad(ctx: BaseAudioContext, type: BiquadFilterType, freq: number, q = 0.7, gain = 0): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  if (gain) f.gain.value = gain;
  return f;
}

export function gainNode(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** Plays a one-shot buffer at `t` through a gain envelope; returns the source and its gain (not yet connected on). */
export function playBuffer(h: VoiceHost, buffer: AudioBuffer, t: number, rate = 1): { src: AudioBufferSourceNode; amp: GainNode } {
  const src = h.ctx.createBufferSource();
  src.buffer = buffer;
  if (rate !== 1) src.playbackRate.value = rate;
  const amp = h.ctx.createGain();
  src.connect(amp);
  return { src, amp };
}
