import type { VoiceHost } from "../types.ts";
import { pairSum, phasedWave } from "../util.ts";

/**
 * The Shepard-Risset glissando (Cinematic v2, engine.ts scoreRiser "shepard"), ported value for value: five
 * octave-spaced tones (each two saws ±8 cents) climbing `speed` octaves a bar forever under a fixed bell over the
 * octaves, each under a lowpass at most `bright` Hz, swelling from a quarter of `level` to it and cut at the line it
 * lands on (Dunkirk tension). `f0` is the lowest register (Hz), `T` the length (s), `barSec` a bar (s).
 * House rule: no noise risers in the dark stations (riser 0 everywhere); this is a tonal riser, for film cues.
 */
export interface ShepardSpec {
  time: number;
  T: number;
  f0: number;
  barSec: number;
  speed?: number;
  level: number;
  bright?: number;
  pan?: number;
}

export function shepard(h: VoiceHost, r: ShepardSpec) {
  const ctx = h.ctx;
  const { time: t, T } = r;
  const K = 5;
  const speed = r.speed ?? 0.5;
  const N = Math.max(2, Math.ceil(T / 0.04) + 1);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.02 * r.level), t + Math.min(1.2, T / 3));
  env.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.08 * r.level), t + T - 0.02);
  env.gain.linearRampToValueAtTime(0, t + T + 0.05);
  const nodes: AudioNode[] = [env];
  const sources: OscillatorNode[] = [];
  let sum: AudioNode | null = null;
  for (let k = 0; k < K; k++) {
    const fr = new Float32Array(N);
    const am = new Float32Array(N);
    const cut = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const sec = (i / (N - 1)) * T;
      const p = (((k + (speed * sec) / r.barSec) % K) + K) % K;
      fr[i] = r.f0 * Math.pow(2, p);
      am[i] = Math.pow(Math.sin((Math.PI * p) / K), 2);
      cut[i] = Math.min(r.bright ?? 2400, fr[i] * 3);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.6;
    lp.frequency.setValueCurveAtTime(cut, t, T);
    const g = ctx.createGain();
    g.gain.setValueCurveAtTime(am, t, T);
    for (const det of [-8, 8]) {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(phasedWave(ctx, "sawtooth", (k * 3 + (det > 0 ? 4 : 0)) % 8));
      osc.detune.value = det;
      osc.frequency.setValueCurveAtTime(fr, t, T);
      osc.connect(lp);
      sources.push(osc);
    }
    lp.connect(g);
    nodes.push(lp, g);
    sum = pairSum(ctx, sum, g, nodes);
  }
  (sum as AudioNode).connect(env);
  nodes.push(...h.out(env, r.pan ?? 0));
  h.play(sources, nodes, t, t + T + 0.1);
}
