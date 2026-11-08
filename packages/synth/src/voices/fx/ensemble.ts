import { PairBus } from "../host.ts";
import { pairSum, phasedWave, stereo } from "../util.ts";

/**
 * Ensemble choruses (width without reverb), ported value for value.
 *
 * `ensembleChorus` (Hamster Dark Electro II v2, engine.ts buildEnsemble): a bus highpassed at `hp` (the sub stays mono)
 * into two short delays (11 and 17 ms) moved by slow sines, panned hard left and right: the bus's upper part widened.
 * The pack used it on bass (above 260 Hz), pads and leads.
 *
 * `stringEnsemble` (Cinematic v2, engine.ts scoreChorusIn): per side three delays around `delay` ms, each swung by a
 * slow LFO at its own phase and a quick 5.5 Hz one at a tenth of the depth: the string machine's ensemble that turns a
 * stack of saws into a section. Voices send into `input` (film voices: their `chorus` amount); `output` joins the bus.
 *
 * Bit-exact offline: the delay times are moved by oscillators into the AudioParam, never by automation.
 */
export interface EnsembleChorusSpec {
  mix: number;
  hp?: number;
  rate?: number;
  depth?: number;
}

/** tap -> [hp -> 2 swung delays, hard L/R] -> returns the stereo output (sum it beside the dry bus). */
export function ensembleChorus(ctx: BaseAudioContext, tap: AudioNode, e: EnsembleChorusSpec): AudioNode {
  const out = ctx.createGain();
  stereo(out);
  const sum = new PairBus(ctx, out);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = e.hp ?? 220;
  hp.Q.value = 0.7;
  tap.connect(hp);
  const depth = (e.depth ?? 2.5) / 1000;
  const rate = e.rate ?? 0.6;
  [-1, 1].forEach((side, i) => {
    const d = ctx.createDelay(0.1);
    d.delayTime.value = i === 0 ? 0.011 : 0.017;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = rate * (i === 0 ? 1 : 1.27);
    const amt = ctx.createGain();
    amt.gain.value = depth;
    lfo.connect(amt);
    amt.connect(d.delayTime);
    lfo.start(0);
    const g = ctx.createGain();
    g.gain.value = e.mix;
    hp.connect(d);
    d.connect(g);
    // Hard left / right (the engine's equal-power pan at -1 and 1).
    const left = ctx.createGain();
    const right = ctx.createGain();
    const merger = ctx.createChannelMerger(2);
    left.gain.value = Math.cos(((side + 1) * Math.PI) / 4);
    right.gain.value = Math.sin(((side + 1) * Math.PI) / 4);
    g.connect(left);
    g.connect(right);
    left.connect(merger, 0, 0);
    right.connect(merger, 0, 1);
    sum.add(merger);
  });
  return out;
}

export interface StringEnsembleSpec {
  /** Slow swing Hz (default 0.5), depth ms (2.5), centre delay ms (10), return level (1). */
  rate: number;
  depth: number;
  delay: number;
  mix: number;
}

/** A stereo send -> the 3-tap-per-side ensemble -> `output` (sum it onto the voice's bus). */
export function stringEnsemble(ctx: BaseAudioContext, e: StringEnsembleSpec = { rate: 0.5, depth: 2.5, delay: 10, mix: 1 }): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  stereo(input);
  const split = ctx.createChannelSplitter(2);
  input.connect(split);
  const merge = ctx.createChannelMerger(2);
  const rest: AudioNode[] = [];
  for (let side = 0; side < 2; side++) {
    let sum: AudioNode | null = null;
    for (let k = 0; k < 3; k++) {
      const d = ctx.createDelay(0.06);
      d.delayTime.value = (e.delay * (0.75 + 0.25 * k) + side * 1.3) / 1000;
      let swing: AudioNode | null = null;
      for (const [rate, depth, ph] of [[e.rate * (1 + 0.11 * k), e.depth, (k * 3 + side * 4) % 8], [5.5 + 0.3 * k, e.depth * 0.1, (k * 5 + side) % 8]] as const) {
        const lfo = ctx.createOscillator();
        lfo.setPeriodicWave(phasedWave(ctx, "sine", ph));
        lfo.frequency.value = rate;
        const g = ctx.createGain();
        g.gain.value = depth / 1000;
        lfo.connect(g);
        lfo.start(0);
        rest.push(g);
        swing = pairSum(ctx, swing, g, rest);
      }
      (swing as AudioNode).connect(d.delayTime);
      split.connect(d, side);
      sum = pairSum(ctx, sum, d, rest);
    }
    const g = ctx.createGain();
    g.gain.value = e.mix / Math.sqrt(3);
    (sum as AudioNode).connect(g);
    g.connect(merge, 0, side);
  }
  const output = ctx.createGain();
  stereo(output);
  merge.connect(output);
  return { input, output };
}
