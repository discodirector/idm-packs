/**
 * Bus processors for the voice library, each built once and inserted between a bus and where it went. All of them are
 * waveshapers, filters and gains: no DynamicsCompressor (not bit-exact offline), so "glue" here is saturation.
 *   tape       a tape / tube stage: a gentle pre-emphasis (+3 dB shelf-ish peak at 3 kHz) into an asymmetric tanh
 *              (even harmonics: warmth), the de-emphasis after, mixed with the dry signal (parallel saturation:
 *              the quiet tails come up against the peaks, the way a bus compressor glues);
 *   exciter    a harmonic exciter: the signal over `freq` Hz driven hard through tanh (new harmonics up top for
 *              dull parts), added back at `amount`;
 *   widen      a mid/side width stage: side x (1 + `amount`), mid as it is (stereo parts wider; a mono part stays mono).
 */
import type { VoiceHost } from "./host.ts";

function stereoGain(ctx: BaseAudioContext, value = 1): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  g.channelCount = 2;
  g.channelCountMode = "explicit";
  g.channelInterpretation = "speakers";
  return g;
}

export function curve(drive: number, asym: number): Float32Array<ArrayBuffer> {
  const n = 2049;
  const c = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    // Asymmetry: the positive half a little harder (even harmonics), re-centred so silence stays silence.
    c[i] = (Math.tanh(drive * (x + asym * x * x)) - Math.tanh(0)) / norm;
  }
  return c;
}

/**
 * Tape saturation from `input` to `dest` (both stereo): returns nothing; `input` is the caller's node (it must not be
 * connected to `dest` already). `drive` 0..4, `mix` 0..1 of the saturated path.
 */
/** Returns its pre-emphasis (the shaper's input) and the dry and wet levels, for a copy keyed by it (the engine's stems). */
export function tape(h: VoiceHost, input: AudioNode, dest: AudioNode, drive: number, mix: number): { pre: AudioNode; dry: number; wet: number } {
  const ctx = h.ctx;
  const dry = stereoGain(ctx, 1 - 0.5 * mix);
  const pre = ctx.createBiquadFilter();
  pre.type = "peaking";
  pre.frequency.value = 3000;
  pre.Q.value = 0.5;
  pre.gain.value = 3;
  const shaper = ctx.createWaveShaper();
  shaper.curve = curve(Math.max(0.1, drive), 0.08);
  shaper.oversample = "none";
  const post = ctx.createBiquadFilter();
  post.type = "peaking";
  post.frequency.value = 3000;
  post.Q.value = 0.5;
  post.gain.value = -3;
  const wet = stereoGain(ctx, mix / Math.max(0.6, Math.tanh(drive) * 1.2));
  input.connect(dry);
  input.connect(pre);
  pre.connect(shaper);
  shaper.connect(post);
  post.connect(wet);
  const sum = stereoGain(ctx);
  dry.connect(sum);
  wet.connect(sum);
  sum.connect(dest);
  return { pre, dry: dry.gain.value, wet: wet.gain.value };
}

/** A harmonic exciter tapping `input` into `dest` (added beside whatever else reaches `dest`). */
export function exciter(h: VoiceHost, input: AudioNode, dest: AudioNode, freq: number, amount: number) {
  const ctx = h.ctx;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = freq;
  hp.Q.value = 0.7;
  const shaper = ctx.createWaveShaper();
  shaper.curve = curve(4, 0);
  shaper.oversample = "none";
  const hp2 = ctx.createBiquadFilter();
  hp2.type = "highpass";
  hp2.frequency.value = freq;
  hp2.Q.value = 0.7;
  const g = stereoGain(ctx, amount * 0.25);
  input.connect(hp);
  hp.connect(shaper);
  shaper.connect(hp2);
  hp2.connect(g);
  g.connect(dest);
}

/** Mid/side widening from `input` to `dest`: L' = L + a (L - R) / 2, R' = R + a (R - L) / 2. */
export function widen(h: VoiceHost, input: AudioNode, dest: AudioNode, amount: number) {
  const ctx = h.ctx;
  const split = ctx.createChannelSplitter(2);
  input.connect(split);
  const merger = ctx.createChannelMerger(2);
  const k = amount / 2;
  // Left out: L (1 + k) - R k; right out: R (1 + k) - L k.
  for (const [own, other, ch] of [[0, 1, 0], [1, 0, 1]] as const) {
    const a = ctx.createGain();
    a.gain.value = 1 + k;
    const b = ctx.createGain();
    b.gain.value = -k;
    split.connect(a, own);
    split.connect(b, other);
    const s = ctx.createGain();
    a.connect(s);
    b.connect(s);
    s.connect(merger, 0, ch);
  }
  merger.connect(dest);
}
