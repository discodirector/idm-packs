import { biquad, gainNode, satCurve, shaper } from "./util.ts";

/**
 * Bus processors for the voice library, built only from nodes that render bit-exactly offline (no DynamicsCompressor):
 * - glue: a feed-forward compressor. The detector downmixes to mono, rectifies (a |x| curve), smooths in a lowpass
 *   (`speed` Hz: ~8 slow glue, ~25 a snappier grab) and maps the level through a gain curve (threshold, ratio, soft
 *   knee) straight onto a VCA's gain. No lookahead, so transients pass a few ms before it bites: the punch stays, the
 *   tail and the body are held together (an SSL bus compressor's job).
 * - tape: an asymmetric soft saturation (even + odd harmonics) with a gentle top roll-off, level-compensated.
 * - exciter: a highpassed copy driven into harmonics and highpassed again, mixed back in parallel: air and presence on
 *   a dull part without making it louder underneath.
 */
export interface GlueSpec {
  /** Threshold, linear (detector full scale 1). */
  thresh: number;
  ratio: number;
  /** Detector smoothing, Hz. */
  speed: number;
  /** Output gain. */
  makeup: number;
}

/** in -> [glue] -> returns the output node (connect it onward). */
export function glue(ctx: BaseAudioContext, input: AudioNode, g: GlueSpec): AudioNode {
  return glueParts(ctx, input, g).out;
}

/**
 * glue, with its gain computer's output (`control`, the VCA's gain signal) for a copy keyed by the same detector
 * (the engine's stems: each stem's VCA follows the mix's glue). Makes exactly the nodes glue makes.
 */
export function glueParts(ctx: BaseAudioContext, input: AudioNode, g: GlueSpec): { out: AudioNode; control: AudioNode } {
  const det = ctx.createGain();
  det.channelCount = 1;
  det.channelCountMode = "explicit";
  det.channelInterpretation = "speakers";
  det.gain.value = 0.5;
  const n = 2049;
  const abs = new Float32Array(n);
  for (let i = 0; i < n; i++) abs[i] = Math.abs((i / (n - 1)) * 2 - 1);
  const rect = shaper(ctx, abs);
  const smooth = biquad(ctx, "lowpass", g.speed, 0.5);
  // Level (0..1 of the detector, = 0..2 of the signal) -> gain; below 0 (filter undershoot) -> 1.
  const curve = new Float32Array(n);
  const t = Math.max(1e-3, g.thresh);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const e = Math.max(0, x) * 2;
    // A 6 dB soft knee around the threshold (in dB over it), the ratio above.
    const over = e > 0 ? 20 * Math.log10(e / t) : -120;
    const W = 6;
    const slope = 1 - 1 / g.ratio;
    const cut = over <= -W / 2 ? 0 : over >= W / 2 ? over * slope : (slope * (over + W / 2) ** 2) / (2 * W);
    const gain = Math.pow(10, -cut / 20);
    curve[i] = gain;
  }
  const map = shaper(ctx, curve);
  const vca = ctx.createGain();
  vca.gain.value = 0;
  const out = gainNode(ctx, g.makeup);
  input.connect(det);
  det.connect(rect);
  rect.connect(smooth);
  smooth.connect(map);
  map.connect(vca.gain);
  input.connect(vca);
  vca.connect(out);
  return { out, control: map };
}

/** in -> [tape] -> returns the output node. `drive` 0.3..3. */
export function tape(ctx: BaseAudioContext, input: AudioNode, drive: number): AudioNode {
  const pre = gainNode(ctx, 1);
  const sat = shaper(ctx, satCurve(drive, 0.18));
  const roll = biquad(ctx, "lowpass", 15000, 0.5);
  // Level compensation: the curve's small-signal slope is drive / tanh(drive)-ish; bring it back to unity.
  const slope = (drive * (1 - Math.tanh(0.18) ** 2)) / Math.max(Math.abs(Math.tanh(drive + 0.18) - Math.tanh(0.18)), Math.abs(Math.tanh(-drive + 0.18) - Math.tanh(0.18)));
  const out = gainNode(ctx, 1 / Math.max(1, slope));
  input.connect(pre);
  pre.connect(sat);
  sat.connect(roll);
  roll.connect(out);
  return out;
}

/** A parallel exciter: returns the harmonics path (connect it into the same sum as the dry part). */
export function exciter(ctx: BaseAudioContext, input: AudioNode, amount: number, freq = 2800): AudioNode {
  const hp1 = biquad(ctx, "highpass", freq, 0.7);
  const drive = gainNode(ctx, 4);
  const sat = shaper(ctx, satCurve(2.5, 0.25));
  const hp2 = biquad(ctx, "highpass", freq, 0.7);
  const out = gainNode(ctx, amount);
  input.connect(hp1);
  hp1.connect(drive);
  drive.connect(sat);
  sat.connect(hp2);
  hp2.connect(out);
  return out;
}
