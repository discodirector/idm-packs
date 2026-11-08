import type { Source, VoiceModule } from "../types.ts";
import { biquad, brightCut, gainNode, lfo, noteOsc, satCurve, shaper, sumAll } from "../util.ts";

/**
 * Analog poly pad after the Juno-60 / 106: the DCO's saw on the left, its pulse (a narrow `duty`) on the right and the
 * square sub an octave down in the middle, each side through a highpass (no mud) and a resonant lowpass whose cutoff
 * swells in with the attack, breathes with a slow LFO and follows the song form. The Juno's BBD chorus is played by
 * the oscillators themselves (a delay line cannot be modulated bit-exactly here): the two sides drift in pitch against
 * each other on one slow LFO in opposite phase, which is what the chorus does to the ear: a wide, moving bed.
 */
const defaults = {
  saw: 0.8,
  pulse: 0.5,
  duty: 0.3,
  sub: 0.25,
  chorus: 9,
  chorusRate: 0.5,
  spread: 0.85,
  cutoff: 1400,
  q: 1.2,
  swell: 0.5,
  lfoRate: 0.11,
  lfoDepth: 0.3,
  bright: 0.45,
  hp: 160,
  drive: 0.6,
  a: 0.6,
  r: 1.2,
  gain: 1,
};
export type AnalogPadParams = typeof defaults;

export const analogPad: VoiceModule<AnalogPadParams> = {
  doc: "Juno-style pad: saw L / pulse R / sub centre, swelling resonant lowpass with LFO, L/R pitch chorus in opposite phase.",
  defaults,
  ranges: {
    saw: [0, 1.5], pulse: [0, 1.5], duty: [0.05, 0.5], sub: [0, 1], chorus: [0, 30], chorusRate: [0.05, 6], spread: [0, 1], cutoff: [100, 10000],
    q: [0.3, 8], swell: [0, 1], lfoRate: [0.02, 4], lfoDepth: [0, 0.9], bright: [0, 0.9], hp: [20, 2000], drive: [0, 4], a: [0.005, 6],
    r: [0.05, 6], gain: [0, 2],
  },
  play(h, n, p) {
    const { ctx } = h;
    const sources: Source[] = [];
    const keep: AudioNode[] = [];
    const chorus = p.chorus > 0 ? lfo(ctx, h.wave("sine", n.seed % 16), p.chorusRate, p.chorus, n.time, sources, keep) : null;
    let chorusInv: GainNode | null = null;
    if (chorus) {
      chorusInv = gainNode(ctx, -1);
      chorus.connect(chorusInv);
      keep.push(chorusInv);
    }
    const cut = brightCut(p.cutoff, n, p.bright);
    const filterLfo = p.lfoDepth > 0 ? lfo(ctx, h.wave("sine", (n.seed + 5) % 16), p.lfoRate, cut * p.lfoDepth, n.time, sources, keep) : null;
    const peak = 0.085 * p.gain * (0.6 + 0.4 * n.vel);
    const attack = Math.min(p.a, Math.max(0.01, n.length * 0.5));
    const end = n.time + n.length + p.r;
    // The sub (a square an octave down) sits in the middle: one oscillator into both sides.
    let sub: GainNode | null = null;
    if (p.sub > 0) {
      const o = noteOsc(ctx, n, 0.5, { wave: h.wave("pulse", 0, 0.5) });
      sub = gainNode(ctx, p.sub);
      o.connect(sub);
      sources.push(o);
      keep.push(sub);
    }
    for (const side of [-1, 1]) {
      // Left a saw, right a pulse: the two halves of the Juno's oscillator, pulled apart by the chorus.
      const o = side < 0
        ? noteOsc(ctx, n, 1, { wave: h.wave("saw", n.seed % 16), detune: -3 })
        : noteOsc(ctx, n, 1, { wave: h.wave("pulse", (n.seed + 7) % 16, p.duty), detune: 3 });
      (side < 0 ? chorus : chorusInv)?.connect(o.detune);
      const g = gainNode(ctx, side < 0 ? p.saw : p.pulse);
      o.connect(g);
      sources.push(o);
      keep.push(g);
      let chain: AudioNode = g;
      if (sub) {
        const both = gainNode(ctx, 1);
        g.connect(both);
        sub.connect(both);
        keep.push(both);
        chain = both;
      }
      if (p.drive > 0) {
        const sh = shaper(ctx, satCurve(p.drive, 0.1));
        chain.connect(sh);
        keep.push(sh);
        chain = sh;
      }
      const hp = biquad(ctx, "highpass", p.hp, 0.6);
      const lp = biquad(ctx, "lowpass", cut, p.q);
      lp.frequency.setValueAtTime(cut * (1 - p.swell * 0.7), n.time);
      lp.frequency.linearRampToValueAtTime(cut, n.time + Math.max(0.05, attack * 1.5));
      filterLfo?.connect(lp.frequency);
      const amp = gainNode(ctx, 0);
      amp.gain.setValueAtTime(0, n.time);
      amp.gain.linearRampToValueAtTime(peak, n.time + attack);
      amp.gain.setValueAtTime(peak, n.time + Math.max(attack, n.length));
      amp.gain.linearRampToValueAtTime(0, end);
      chain.connect(hp);
      hp.connect(lp);
      lp.connect(amp);
      keep.push(hp, lp, amp, ...h.out(amp, n.pan + side * p.spread));
    }
    h.play(sources, keep, n.time, end + 0.05);
  },
};
