import type { Source, VoiceModule } from "./types.ts";
import { biquad, brightCut, gainNode, noteOsc, sumAll } from "./util.ts";

/**
 * Three-operator FM bell: two modulators on inharmonic ratios (3.5 and 7.07 by default: a struck bar's partials) each
 * with its own index fall, summed into two carriers a few cents apart, left and right, so the bell beats and lives in
 * stereo; a quiet sine an octave under gives dark bells a body. Velocity sets the hardness (the indices); the tail is
 * an exponential ring of `ring` s. A lowpass that follows the song form keeps it from going glassy. Trap / drill bells,
 * music boxes, celestas, mallets (ratio 4 = a vibraphone's bar).
 */
const defaults = {
  ratio1: 3.5,
  index1: 2.2,
  decay1: 0.9,
  ratio2: 7.07,
  index2: 0.8,
  decay2: 0.08,
  detune: 6,
  spread: 0.6,
  sub: 0.2,
  ring: 1.4,
  lp: 4200,
  bright: 0.35,
  trem: 0,
  tremRate: 5.2,
  r: 0.5,
  gain: 1,
};
export type FmBellParams = typeof defaults;

export const fmBell: VoiceModule<FmBellParams> = {
  doc: "3-op FM bell (two inharmonic modulators, own index falls) on twin detuned carriers L/R, sub body, motor tremolo option.",
  defaults,
  ranges: {
    ratio1: [0.5, 12], index1: [0, 10], decay1: [0.01, 4], ratio2: [0.5, 16], index2: [0, 10], decay2: [0.005, 2], detune: [0, 30], spread: [0, 1],
    sub: [0, 1], ring: [0.05, 6], lp: [500, 14000], bright: [0, 0.9], trem: [0, 1], tremRate: [0.5, 10], r: [0.02, 3], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const f = n.freq;
    const hard = 0.35 + 0.65 * n.vel;
    const mods: AudioNode[] = [];
    for (const [ratio, index, decay] of [[p.ratio1, p.index1, p.decay1], [p.ratio2, p.index2, p.decay2]]) {
      if (index <= 0) continue;
      const m = noteOsc(ctx, n, ratio, { type: "sine" });
      const g = gainNode(ctx, 0);
      g.gain.setValueAtTime(f * index * hard, n.time);
      g.gain.exponentialRampToValueAtTime(Math.max(0.01, f * index * hard * 0.03), n.time + decay);
      m.connect(g);
      sources.push(m);
      keep.push(g);
      mods.push(g);
    }
    const mod = sumAll(ctx, mods, keep);
    const peak = 0.1 * p.gain * hard;
    const hold = Math.max(0.03, n.length);
    const end = n.time + hold + p.r;
    const ring = (g: AudioParam, level: number) => {
      g.setValueAtTime(0, n.time);
      g.linearRampToValueAtTime(level, n.time + 0.002);
      g.setTargetAtTime(0, n.time + 0.002, p.ring / 6.9);
      g.setValueAtTime(level * Math.exp((-6.9 * hold) / p.ring), n.time + hold);
      g.exponentialRampToValueAtTime(0.0001, end);
      g.setValueAtTime(0, end);
    };
    const lpHz = brightCut(p.lp, n, p.bright);
    for (const side of [-1, 1]) {
      const car = noteOsc(ctx, n, 1, { type: "sine", detune: (side * p.detune) / 2 });
      mod?.connect(car.frequency);
      const amp = gainNode(ctx, 0);
      ring(amp.gain, peak * 0.7);
      car.connect(amp);
      let out: AudioNode = amp;
      if (p.trem > 0) {
        const t = gainNode(ctx, 1 - p.trem / 2);
        const lf = ctx.createOscillator();
        lf.setPeriodicWave(h.wave("sine", (n.seed + (side > 0 ? 8 : 0)) % 16));
        lf.frequency.setValueAtTime(p.tremRate, n.time);
        const d = gainNode(ctx, p.trem / 2);
        lf.connect(d);
        d.connect(t.gain);
        amp.connect(t);
        sources.push(lf);
        keep.push(t, d);
        out = t;
      }
      const lp = biquad(ctx, "lowpass", lpHz, 0.5);
      out.connect(lp);
      sources.push(car);
      keep.push(amp, lp, ...h.out(lp, n.pan + side * p.spread));
    }
    if (p.sub > 0) {
      const o = noteOsc(ctx, n, 0.5, { type: "sine" });
      const amp = gainNode(ctx, 0);
      ring(amp.gain, peak * p.sub);
      o.connect(amp);
      sources.push(o);
      keep.push(amp, ...h.out(amp, n.pan));
    }
    h.play(sources, keep, n.time, end + 0.05);
  },
};
