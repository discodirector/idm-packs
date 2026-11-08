import type { Source, VoiceModule } from "../types.ts";
import { biquad, brightCut, gainNode, lfo, noteOsc } from "../util.ts";

/**
 * String ensemble after the Solina / ARP String Ensemble and a section played legato: three saws per note, the outer
 * two drifting against each other on one slow LFO in opposite phase and the centre on a fast shallow shimmer (the
 * ensemble chorus), the centre shared by both sides; a delayed vibrato, a bow-noise layer around the 5th partial,
 * a highpass (no mud under the chord) and a lowpass that opens with the swell and the song form. Ominous drill
 * strings, G-funk string pads, cinematic beds.
 */
const defaults = {
  ensemble: 12,
  ensembleRate: 0.6,
  shimmer: 4,
  vib: 10,
  vibRate: 5.2,
  vibDelay: 0.4,
  bow: 0.12,
  spread: 0.9,
  cutoff: 2600,
  bright: 0.4,
  hp: 220,
  a: 0.5,
  r: 0.9,
  gain: 1,
};
export type StringsParams = typeof defaults;

export const strings: VoiceModule<StringsParams> = {
  doc: "String ensemble: 3 saws (outer pair on an opposite-phase drift, centre shimmer), delayed vibrato, bow noise, swelling lowpass.",
  defaults,
  ranges: {
    ensemble: [0, 40], ensembleRate: [0.05, 6], shimmer: [0, 20], vib: [0, 40], vibRate: [0.5, 9], vibDelay: [0, 2], bow: [0, 1], spread: [0, 1],
    cutoff: [200, 12000], bright: [0, 0.9], hp: [20, 2000], a: [0.005, 6], r: [0.05, 6], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const cut = brightCut(p.cutoff, n, p.bright);
    const attack = Math.min(p.a, Math.max(0.01, n.length * 0.6));
    const end = n.time + n.length + p.r;
    const peak = 0.075 * p.gain * (0.55 + 0.45 * n.vel);
    const vibHz = n.freq * (Math.pow(2, p.vib / 1200) - 1);
    const vib = p.vib > 0 ? lfo(ctx, h.wave("sine", n.seed % 16), p.vibRate, vibHz, n.time, sources, keep, p.vibDelay) : null;
    // The ensemble: one slow drift, +/- on the outer voices (opposite phase), a fast shimmer on the centre.
    const slow = p.ensemble > 0 ? lfo(ctx, h.wave("sine", (n.seed + 3) % 16), p.ensembleRate, p.ensemble, n.time, sources, keep) : null;
    let slowInv: GainNode | null = null;
    if (slow) {
      slowInv = gainNode(ctx, -1);
      slow.connect(slowInv);
      keep.push(slowInv);
    }
    const fast = p.shimmer > 0 ? lfo(ctx, h.wave("sine", (n.seed + 9) % 16), 6.3, p.shimmer, n.time, sources, keep) : null;
    const saw = (side: number, k: number) => {
      const o = noteOsc(ctx, n, 1, { wave: h.wave("saw", (n.seed + k) % 16), detune: side * 5 });
      (side < 0 ? slow : side > 0 ? slowInv : fast)?.connect(o.detune);
      vib?.connect(o.frequency);
      const g = gainNode(ctx, side === 0 ? 0.6 : 1);
      o.connect(g);
      sources.push(o);
      keep.push(g);
      return g;
    };
    const centre = saw(0, 11);
    const env = (g: AudioParam, level: number) => {
      g.setValueAtTime(0, n.time);
      g.linearRampToValueAtTime(level, n.time + attack);
      g.setValueAtTime(level, n.time + Math.max(attack, n.length));
      g.linearRampToValueAtTime(0, end);
    };
    for (const side of [-1, 1]) {
      const both = gainNode(ctx, 1);
      saw(side, side < 0 ? 0 : 6).connect(both);
      centre.connect(both);
      const hp = biquad(ctx, "highpass", p.hp, 0.6);
      const lp = biquad(ctx, "lowpass", cut, 0.7);
      lp.frequency.setValueAtTime(cut * 0.45, n.time);
      lp.frequency.linearRampToValueAtTime(cut, n.time + attack * 1.3);
      const amp = gainNode(ctx, 0);
      env(amp.gain, peak);
      both.connect(hp);
      hp.connect(lp);
      lp.connect(amp);
      keep.push(both, hp, lp, amp, ...h.out(amp, n.pan + side * p.spread));
    }
    if (p.bow > 0) {
      const src = ctx.createBufferSource();
      src.buffer = h.noise();
      src.loop = true;
      const bp = biquad(ctx, "bandpass", Math.min(9000, n.freq * 5), 2.5);
      const amp = gainNode(ctx, 0);
      env(amp.gain, peak * p.bow);
      src.connect(bp);
      bp.connect(amp);
      sources.push(src);
      keep.push(bp, amp, ...h.out(amp, n.pan));
    }
    h.play(sources, keep, n.time, end + 0.05);
  },
};
